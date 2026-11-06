import { Request, Response, NextFunction } from "express"
import { OrderRepository, InsufficientStockError } from "./order.Repository.js"
import { Order, ORDER_STATUSES, OrderStatus, NEXT_STATUS } from "./order.entity.js"
import { db } from "../shared/db/conn.js"
import { parseObjectId } from "../shared/objectId.js"
import { Product } from "../product/product.entity.js"
import { DiscountRepository, applyDiscount } from "../discount/discount.Repository.js"
import { roundCents } from "../shared/money.js"

const repository = new OrderRepository()
const discountRepository = new DiscountRepository()

function sanitizeOrderInput(req: Request, res: Response, next: NextFunction) {
  // date y total no se aceptan del cliente: los define el sistema; el estado se cambia con PATCH /:id/status
  req.body.sanitizedInput = {
    userId: req.body.userId,
  }

  Object.keys(req.body.sanitizedInput).forEach((key) => {
    if (req.body.sanitizedInput[key] === undefined) {
      delete req.body.sanitizedInput[key]
    }
  })
  next()
}

function validateStatus(value: unknown): string | null {
  if (typeof value !== "string" || !ORDER_STATUSES.includes(value as OrderStatus)) {
    return `El estado debe ser uno de: ${ORDER_STATUSES.join(", ")}`
  }
  return null
}

async function userExists(userId: unknown) {
  return !!(await db.collection("users").findOne({ _id: parseObjectId(userId)! }))
}

async function findAll(req: Request, res: Response) {
  const userIdParam = req.query.userId
  if (userIdParam === undefined) {
    return res.json({ data: await repository.findAll() })
  }
  const userId = parseObjectId(userIdParam)
  if (!userId) {
    return res.status(400).send({ message: "userId inválido" })
  }
  return res.json({ data: await repository.findAll({ userId }) })
}

async function findOne(req: Request, res: Response) {
  const id = req.params.id as string
  if (!parseObjectId(id)) {
    return res.status(400).send({ message: "Id de pedido inválido" })
  }
  const order = await repository.findOne({ id })
  if (!order) {
    return res.status(404).send({ message: "Pedido no encontrado" })
  }
  // detalle del pedido: productos, cantidades y precios de cada ítem
  res.json({ data: { ...order, items: await repository.findItems(order._id!) } })
}

async function add(req: Request, res: Response) {
  const input = req.body.sanitizedInput as Record<string, unknown>
  if (parseObjectId(input.userId) === null) {
    return res.status(400).send({ message: "userId inválido" })
  }
  if (!(await userExists(input.userId))) {
    return res.status(404).send({ message: "Usuario no encontrado" })
  }

  // todo pedido nace pendiente, con la fecha actual y sin ítems (total 0)
  const orderInput = new Order(parseObjectId(input.userId)!, new Date(), "pendiente", 0)
  const order = await repository.add(orderInput)
  return res.status(201).send({ message: "Pedido creado", data: order })
}

async function update(req: Request, res: Response) {
  const id = req.params.id as string
  if (!parseObjectId(id)) {
    return res.status(400).send({ message: "Id de pedido inválido" })
  }

  if (req.body.status !== undefined) {
    return res.status(400).send({ message: "El estado se cambia con PATCH /api/orders/:id/status" })
  }
  const input = req.body.sanitizedInput as Record<string, unknown>
  if (Object.keys(input).length === 0) {
    return res.status(400).send({ message: "No hay campos para actualizar" })
  }
  if (parseObjectId(input.userId) === null) {
    return res.status(400).send({ message: "userId inválido" })
  }

  const existing = await repository.findOne({ id })
  if (!existing) {
    return res.status(404).send({ message: "Pedido no encontrado" })
  }

  if (existing.status !== "pendiente") {
    return res.status(409).send({ message: "Solo se puede cambiar el usuario de un pedido pendiente" })
  }
  if (!(await userExists(input.userId))) {
    return res.status(404).send({ message: "Usuario no encontrado" })
  }

  const order = await repository.update(id, { userId: parseObjectId(input.userId)! } as Order)
  return res.status(200).send({ message: "Pedido actualizado", data: order })
}

// Epic 2: avanza el pedido al estado siguiente; al pasar a pagado se descuenta el stock
async function changeStatus(req: Request, res: Response) {
  const id = req.params.id as string
  if (!parseObjectId(id)) {
    return res.status(400).send({ message: "Id de pedido inválido" })
  }
  const statusError = validateStatus(req.body.status)
  if (statusError) {
    return res.status(400).send({ message: statusError })
  }
  const status = req.body.status as OrderStatus

  const existing = await repository.findOne({ id })
  if (!existing) {
    return res.status(404).send({ message: "Pedido no encontrado" })
  }

  const next = NEXT_STATUS[existing.status]
  if (status !== next) {
    const allowed = next ? `solo puede pasar a ${next}` : "ya no puede cambiar de estado"
    return res.status(409).send({ message: `Un pedido ${existing.status} ${allowed}` })
  }
  if (status === "pagado" && (await repository.findItems(existing._id!)).length === 0) {
    return res.status(409).send({ message: "No se puede pagar un pedido sin ítems" })
  }

  try {
    const order = await repository.changeStatus(existing._id!, existing.status, status)
    if (!order) {
      return res.status(409).send({ message: "El pedido cambió de estado mientras se procesaba; volvé a intentar" })
    }
    return res.status(200).send({ message: `Pedido ${status}`, data: order })
  } catch (err) {
    if (err instanceof InsufficientStockError) {
      return res.status(409).send({ message: "Stock insuficiente para pagar el pedido", data: { productId: err.productId } })
    }
    throw err
  }
}

async function remove(req: Request, res: Response) {
  const id = req.params.id as string
  if (!parseObjectId(id)) {
    return res.status(400).send({ message: "Id de pedido inválido" })
  }

  const existing = await repository.findOne({ id })
  if (!existing) {
    return res.status(404).send({ message: "Pedido no encontrado" })
  }
  // un pedido pagado o posterior es historial de compras: no se borra
  if (existing.status !== "pendiente") {
    return res.status(409).send({ message: "Solo se puede dar de baja un pedido pendiente" })
  }

  await repository.delete({ id })
  res.status(200).send({ message: "Pedido eliminado" })
}

// Epic 1: convierte el carrito en un pedido pendiente con sus ítems
async function checkout(req: Request, res: Response) {
  const { userId, items } = req.body ?? {}

  if (parseObjectId(userId) === null) {
    return res.status(400).send({ message: "userId inválido" })
  }
  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).send({ message: "El carrito no puede estar vacío" })
  }

  // valida cada renglón y junta las cantidades si un producto aparece más de una vez
  const quantities = new Map<string, number>()
  for (const item of items) {
    const productId = parseObjectId(item?.productId)
    if (!productId) {
      return res.status(400).send({ message: "productId inválido en el carrito" })
    }
    if (typeof item.quantity !== "number" || !Number.isInteger(item.quantity) || item.quantity < 1) {
      return res.status(400).send({ message: "La cantidad debe ser un entero mayor o igual a 1" })
    }
    const key = productId.toString()
    quantities.set(key, (quantities.get(key) ?? 0) + item.quantity)
  }

  if (!(await userExists(userId))) {
    return res.status(404).send({ message: "Usuario no encontrado" })
  }

  const productIds = [...quantities.keys()].map((id) => parseObjectId(id)!)
  const products = await db.collection<Product>("products").find({ _id: { $in: productIds } }).toArray()
  if (products.length !== productIds.length) {
    return res.status(404).send({ message: "Algún producto del carrito no existe" })
  }

  const withoutStock = products.filter((p) => p.stock < quantities.get(p._id!.toString())!)
  if (withoutStock.length > 0) {
    return res.status(409).send({
      message: "Stock insuficiente",
      data: withoutStock.map((p) => ({ productId: p._id, name: p.name, stock: p.stock, requested: quantities.get(p._id!.toString()) })),
    })
  }

  // el precio unitario se congela con el precio actual del producto menos el descuento vigente de su categoría
  const discounts = await discountRepository.bestActive(products.map((p) => p.categoryId))
  const orderItems = products.map((p) => {
    const quantity = quantities.get(p._id!.toString())!
    const unitPrice = applyDiscount(p.price, discounts.get(p.categoryId.toString()) ?? 0)
    return { productId: p._id!, quantity, unitPrice, subtotal: roundCents(quantity * unitPrice) }
  })
  const total = roundCents(orderItems.reduce((sum, item) => sum + item.subtotal, 0))

  // el stock se valida acá y se descuenta recién al pagar (changeStatus), que lo vuelve a validar
  const result = await repository.addWithItems(new Order(parseObjectId(userId)!, new Date(), "pendiente", total), orderItems)
  return res.status(201).send({ message: "Pedido creado", data: result })
}

export { sanitizeOrderInput, findAll, findOne, add, update, remove, checkout, changeStatus }
