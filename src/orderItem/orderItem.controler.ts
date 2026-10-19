import { Request, Response, NextFunction } from "express"
import { OrderItemRepository } from "./orderItem.Repository.js"
import { OrderItem } from "./orderItem.entity.js"
import { db } from "../shared/db/conn.js"
import { parseObjectId } from "../shared/objectId.js"
import { Product } from "../product/product.entity.js"

const repository = new OrderItemRepository()

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
    return "Invalid order id"
  }
  if (!("productId" in input) || parseObjectId(input.productId) === null) {
    return "Invalid product id"
  }
  if (!("quantity" in input) || typeof input.quantity !== "number" || !Number.isInteger(input.quantity) || input.quantity < 1) {
    return "Quantity must be an integer greater than or equal to 1"
  }
  return null
}

function validateForUpdate(input: Record<string, unknown>): string | null {
  if ("orderId" in input && parseObjectId(input.orderId) === null) {
    return "Invalid order id"
  }
  if ("productId" in input && parseObjectId(input.productId) === null) {
    return "Invalid product id"
  }
  if ("quantity" in input) {
    if (typeof input.quantity !== "number" || !Number.isInteger(input.quantity) || input.quantity < 1) {
      return "Quantity must be an integer greater than or equal to 1"
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
    return res.status(400).send({ message: "Invalid order item id" })
  }
  const orderItem = await repository.findOne({ id })
  if (!orderItem) {
    return res.status(404).send({ message: "Order item not found" })
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

  const order = await db.collection("orders").findOne({ _id: orderId })
  if (!order) {
    return res.status(404).send({ message: "Order not found" })
  }

  const product = await db.collection<Product>("products").findOne({ _id: productId })
  if (!product) {
    return res.status(404).send({ message: "Product not found" })
  }

  const unitPrice = product.price
  const subtotal = quantity * unitPrice

  const orderItemInput = new OrderItem(orderId, productId, quantity, unitPrice, subtotal)
  const orderItem = await repository.add(orderItemInput)
  return res.status(201).send({ message: "Order item created", data: orderItem })
}

async function update(req: Request, res: Response) {
  const id = req.params.id as string
  if (!parseObjectId(id)) {
    return res.status(400).send({ message: "Invalid order item id" })
  }

  const input = req.body.sanitizedInput as Record<string, unknown>
  if (Object.keys(input).length === 0) {
    return res.status(400).send({ message: "No fields to update" })
  }

  const validationError = validateForUpdate(input)
  if (validationError) {
    return res.status(400).send({ message: validationError })
  }

  const existing = await repository.findOne({ id })
  if (!existing) {
    return res.status(404).send({ message: "Order item not found" })
  }

  const orderId = "orderId" in input ? parseObjectId(input.orderId)! : existing.orderId
  const productId = "productId" in input ? parseObjectId(input.productId)! : existing.productId
  const quantity = "quantity" in input ? (input.quantity as number) : existing.quantity

  if ("orderId" in input) {
    const order = await db.collection("orders").findOne({ _id: orderId })
    if (!order) {
      return res.status(404).send({ message: "Order not found" })
    }
  }

  let unitPrice = existing.unitPrice
  if ("productId" in input) {
    const product = await db.collection<Product>("products").findOne({ _id: productId })
    if (!product) {
      return res.status(404).send({ message: "Product not found" })
    }
    unitPrice = product.price
  }

  const subtotal = quantity * unitPrice

  const merged = {
    orderId,
    productId,
    quantity,
    unitPrice,
    subtotal,
  }

  const orderItem = await repository.update(id, merged as OrderItem)
  return res.status(200).send({ message: "Order item updated successfully", data: orderItem })
}

async function remove(req: Request, res: Response) {
  const id = req.params.id as string
  if (!parseObjectId(id)) {
    return res.status(400).send({ message: "Invalid order item id" })
  }

  const orderItem = await repository.delete({ id })
  if (!orderItem) {
    return res.status(404).send({ message: "Order item not found" })
  }
  res.status(200).send({ message: "Order item deleted successfully" })
}

export { sanitizeOrderItemInput, findAll, findOne, add, update, remove }
