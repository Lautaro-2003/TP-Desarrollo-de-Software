import { Request, Response, NextFunction } from "express"
import { OrderItemRepository } from "./orderItem.Repository.js"
import { OrderItem } from "./orderItem.entity.js"
import { db } from "../shared/db/conn.js"
import { parseObjectId } from "../shared/objectId.js"
import { Product } from "../product/product.entity.js"
import { Order } from "../order/order.entity.js"
import { OrderRepository } from "../order/order.Repository.js"
import { ObjectId } from "mongodb"
import { DiscountRepository, applyDiscount } from "../discount/discount.Repository.js"
import { roundCents } from "../shared/money.js"

const repository = new OrderItemRepository()
const orderRepository = new OrderRepository()
const discountRepository = new DiscountRepository()

// precio que se congela en el ítem: precio actual menos el descuento vigente de la categoría
async function currentPrice(product: Product): Promise<number> {
  const discounts = await discountRepository.bestActive([product.categoryId])
  return applyDiscount(product.price, discounts.get(product.categoryId.toString()) ?? 0)
}

// los ítems solo se pueden tocar mientras el pedido está pendiente
async function checkOrderEditable(orderId: ObjectId): Promise<{ status: number; message: string } | null> {
  const order = await db.collection<Order>("orders").findOne({ _id: orderId })
  if (!order) {
    return { status: 404, message: "Pedido no encontrado" }
  }
  if (order.status !== "pendiente") {
    return { status: 409, message: "Solo se pueden modificar ítems de un pedido pendiente" }
  }
  return null
}

function sanitizeOrderItemInput(req: Request, res: Response, next: NextFunction) {
  req.body.sanitizedInput = {
    orderId: req.body.orderId,
    productId: req.body.productId,
    quantity: req.body.quantity,
  }

  Object.keys(req.body.sanitizedInput).forEach((key) => {
    if (req.body.sanitizedInput[key] === undefined) {
      delete req.body.sanitizedInput[key]
    }
  })
  next()
}

function validateForCreate(input: Record<string, unknown>): string | null {
  if (!("orderId" in input) || parseObjectId(input.orderId) === null) {
    return "Id de pedido inválido"
  }
  if (!("productId" in input) || parseObjectId(input.productId) === null) {
    return "Id de producto inválido"
  }
  if (!("quantity" in input) || typeof input.quantity !== "number" || !Number.isInteger(input.quantity) || input.quantity < 1) {
    return "La cantidad debe ser un entero mayor o igual a 1"
  }
  return null
}

function validateForUpdate(input: Record<string, unknown>): string | null {
  if ("orderId" in input && parseObjectId(input.orderId) === null) {
    return "Id de pedido inválido"
  }
  if ("productId" in input && parseObjectId(input.productId) === null) {
    return "Id de producto inválido"
  }
  if ("quantity" in input) {
    if (typeof input.quantity !== "number" || !Number.isInteger(input.quantity) || input.quantity < 1) {
      return "La cantidad debe ser un entero mayor o igual a 1"
    }
  }
  return null
}

async function findAll(req: Request, res: Response) {
  res.json({ data: await repository.findAll() })
}

async function findOne(req: Request, res: Response) {
  const id = req.params.id as string
  if (!parseObjectId(id)) {
    return res.status(400).send({ message: "Id de ítem de pedido inválido" })
  }
  const orderItem = await repository.findOne({ id })
  if (!orderItem) {
    return res.status(404).send({ message: "Ítem de pedido no encontrado" })
  }
  res.json({ data: orderItem })
}

async function add(req: Request, res: Response) {
  const input = req.body.sanitizedInput as Record<string, unknown>
  const validationError = validateForCreate(input)
  if (validationError) {
    return res.status(400).send({ message: validationError })
  }

  const orderId = parseObjectId(input.orderId)!
  const productId = parseObjectId(input.productId)!
  const quantity = input.quantity as number

  const orderError = await checkOrderEditable(orderId)
  if (orderError) {
    return res.status(orderError.status).send({ message: orderError.message })
  }

  const product = await db.collection<Product>("products").findOne({ _id: productId })
  if (!product) {
    return res.status(404).send({ message: "Producto no encontrado" })
  }

  const unitPrice = await currentPrice(product)
  const subtotal = roundCents(quantity * unitPrice)

  const orderItemInput = new OrderItem(orderId, productId, quantity, unitPrice, subtotal)
  const orderItem = await repository.add(orderItemInput)
  await orderRepository.recalculateTotal(orderId)
  return res.status(201).send({ message: "Ítem de pedido creado", data: orderItem })
}

async function update(req: Request, res: Response) {
  const id = req.params.id as string
  if (!parseObjectId(id)) {
    return res.status(400).send({ message: "Id de ítem de pedido inválido" })
  }

  const input = req.body.sanitizedInput as Record<string, unknown>
  if (Object.keys(input).length === 0) {
    return res.status(400).send({ message: "No hay campos para actualizar" })
  }

  const validationError = validateForUpdate(input)
  if (validationError) {
    return res.status(400).send({ message: validationError })
  }

  const existing = await repository.findOne({ id })
  if (!existing) {
    return res.status(404).send({ message: "Ítem de pedido no encontrado" })
  }

  const orderId = "orderId" in input ? parseObjectId(input.orderId)! : existing.orderId
  const productId = "productId" in input ? parseObjectId(input.productId)! : existing.productId
  const quantity = "quantity" in input ? (input.quantity as number) : existing.quantity

  // tanto el pedido actual como el nuevo (si se mueve el ítem) tienen que estar pendientes
  for (const affectedOrderId of new Set([existing.orderId.toString(), orderId.toString()])) {
    const orderError = await checkOrderEditable(new ObjectId(affectedOrderId))
    if (orderError) {
      return res.status(orderError.status).send({ message: orderError.message })
    }
  }

  let unitPrice = existing.unitPrice
  if ("productId" in input) {
    const product = await db.collection<Product>("products").findOne({ _id: productId })
    if (!product) {
      return res.status(404).send({ message: "Producto no encontrado" })
    }
    unitPrice = await currentPrice(product)
  }

  const subtotal = roundCents(quantity * unitPrice)

  const merged = {
    orderId,
    productId,
    quantity,
    unitPrice,
    subtotal,
  }

  const orderItem = await repository.update(id, merged as OrderItem)
  await orderRepository.recalculateTotal(orderId)
  if (!existing.orderId.equals(orderId)) {
    await orderRepository.recalculateTotal(existing.orderId)
  }
  return res.status(200).send({ message: "Ítem de pedido actualizado", data: orderItem })
}

async function remove(req: Request, res: Response) {
  const id = req.params.id as string
  if (!parseObjectId(id)) {
    return res.status(400).send({ message: "Id de ítem de pedido inválido" })
  }

  const existing = await repository.findOne({ id })
  if (!existing) {
    return res.status(404).send({ message: "Ítem de pedido no encontrado" })
  }

  const orderError = await checkOrderEditable(existing.orderId)
  if (orderError) {
    return res.status(orderError.status).send({ message: orderError.message })
  }

  await repository.delete({ id })
  await orderRepository.recalculateTotal(existing.orderId)
  res.status(200).send({ message: "Ítem de pedido eliminado" })
}

export { sanitizeOrderItemInput, findAll, findOne, add, update, remove }
