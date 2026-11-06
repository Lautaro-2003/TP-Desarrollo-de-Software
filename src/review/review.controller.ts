import { Request, Response, NextFunction } from "express"
import { MongoServerError } from "mongodb"
import { ReviewRepository } from "./review.Repository.js"
import { Review } from "./review.entity.js"
import { db } from "../shared/db/conn.js"
import { parseObjectId } from "../shared/objectId.js"
import { canAccess } from "../auth/auth.js"

const repository = new ReviewRepository()

function sanitizeReviewInput(req: Request, res: Response, next: NextFunction) {
  req.body.sanitizedInput = {
    userId: req.body.userId,
    productId: req.body.productId,
    rating: req.body.rating,
    comment: req.body.comment,
  }

  Object.keys(req.body.sanitizedInput).forEach((key) => {
    if (req.body.sanitizedInput[key] === undefined) {
      delete req.body.sanitizedInput[key]
    }
  })
  next()
}

// valida los campos editables; devuelve el mensaje de error o null si es válido
function validateContent(input: Record<string, unknown>): string | null {
  if ("rating" in input && (typeof input.rating !== "number" || !Number.isInteger(input.rating) || input.rating < 1 || input.rating > 5)) {
    return "La calificación debe ser un entero de 1 a 5"
  }
  if ("comment" in input && (typeof input.comment !== "string" || input.comment.trim().length < 1 || input.comment.trim().length > 1000)) {
    return "El comentario es obligatorio (hasta 1000 caracteres)"
  }
  return null
}

async function findAll(req: Request, res: Response) {
  const productIdParam = req.query.productId
  if (productIdParam === undefined) {
    return res.json({ data: await repository.findAll() })
  }
  const productId = parseObjectId(productIdParam)
  if (!productId) {
    return res.status(400).send({ message: "productId inválido" })
  }
  return res.json({ data: await repository.findAll({ productId }) })
}

async function findOne(req: Request, res: Response) {
  const id = req.params.id as string
  if (!parseObjectId(id)) {
    return res.status(400).send({ message: "Id de reseña inválido" })
  }
  const review = await repository.findOne({ id })
  if (!review) {
    return res.status(404).send({ message: "Reseña no encontrada" })
  }
  res.json({ data: review })
}

async function add(req: Request, res: Response) {
  const input = req.body.sanitizedInput as Record<string, unknown>
  // el autor es siempre quien inició sesión: no se puede reseñar en nombre de otro
  const userId = parseObjectId(req.user!.id)
  const productId = parseObjectId(input.productId)
  if (!userId) {
    return res.status(400).send({ message: "userId inválido" })
  }
  if (!productId) {
    return res.status(400).send({ message: "productId inválido" })
  }
  if (!("rating" in input) || !("comment" in input)) {
    return res.status(400).send({ message: "La calificación y el comentario son obligatorios" })
  }
  const validationError = validateContent(input)
  if (validationError) {
    return res.status(400).send({ message: validationError })
  }

  if (!(await db.collection("users").findOne({ _id: userId }))) {
    return res.status(404).send({ message: "Usuario no encontrado" })
  }
  if (!(await db.collection("products").findOne({ _id: productId }))) {
    return res.status(404).send({ message: "Producto no encontrado" })
  }
  if (!(await repository.hasPurchased(userId, productId))) {
    return res.status(403).send({ message: "Solo puede reseñar un producto quien lo compró" })
  }

  try {
    const review = await repository.add(
      new Review(userId, productId, input.rating as number, (input.comment as string).trim(), new Date())
    )
    await repository.recalculateProductRating(productId)
    return res.status(201).send({ message: "Reseña creada", data: review })
  } catch (err) {
    // 11000 = clave duplicada en el índice único (userId, productId)
    if (err instanceof MongoServerError && err.code === 11000) {
      return res.status(409).send({ message: "El usuario ya reseñó este producto" })
    }
    throw err
  }
}

async function update(req: Request, res: Response) {
  const id = req.params.id as string
  if (!parseObjectId(id)) {
    return res.status(400).send({ message: "Id de reseña inválido" })
  }

  const input = req.body.sanitizedInput as Record<string, unknown>
  if ("userId" in input || "productId" in input) {
    return res.status(400).send({ message: "No se puede cambiar el autor ni el producto de una reseña" })
  }
  if (Object.keys(input).length === 0) {
    return res.status(400).send({ message: "No hay campos para actualizar" })
  }
  const validationError = validateContent(input)
  if (validationError) {
    return res.status(400).send({ message: validationError })
  }

  const existing = await repository.findOne({ id })
  if (!existing) {
    return res.status(404).send({ message: "Reseña no encontrada" })
  }
  if (!canAccess(req, existing.userId)) {
    return res.status(403).send({ message: "Solo podés modificar tus propias reseñas" })
  }

  const fields: Partial<Review> = {}
  if ("rating" in input) fields.rating = input.rating as number
  if ("comment" in input) fields.comment = (input.comment as string).trim()

  const review = await repository.update(id, fields as Review)
  await repository.recalculateProductRating(existing.productId)
  return res.status(200).send({ message: "Reseña actualizada", data: review })
}

async function remove(req: Request, res: Response) {
  const id = req.params.id as string
  if (!parseObjectId(id)) {
    return res.status(400).send({ message: "Id de reseña inválido" })
  }

  const existing = await repository.findOne({ id })
  if (!existing) {
    return res.status(404).send({ message: "Reseña no encontrada" })
  }
  // el admin puede borrar cualquier reseña (moderación); el cliente solo las suyas
  if (!canAccess(req, existing.userId)) {
    return res.status(403).send({ message: "Solo podés borrar tus propias reseñas" })
  }

  await repository.delete({ id })
  await repository.recalculateProductRating(existing.productId)
  res.status(200).send({ message: "Reseña eliminada" })
}

export { sanitizeReviewInput, findAll, findOne, add, update, remove }
