import { Request, Response, NextFunction } from "express"
import { DiscountRepository } from "./discount.Repository.js"
import { Discount } from "./discount.entity.js"
import { db } from "../shared/db/conn.js"
import { parseObjectId } from "../shared/objectId.js"

const repository = new DiscountRepository()

function sanitizeDiscountInput(req: Request, res: Response, next: NextFunction) {
  req.body.sanitizedInput = {
    categoryId: req.body.categoryId,
    percentage: req.body.percentage,
    startDate: req.body.startDate,
    endDate: req.body.endDate,
  }

  Object.keys(req.body.sanitizedInput).forEach((key) => {
    if (req.body.sanitizedInput[key] === undefined) {
      delete req.body.sanitizedInput[key]
    }
  })
  next()
}

// fecha en formato ISO (ej. "2026-12-01" o "2026-12-01T00:00:00Z"); null si no es válida
function parseDate(value: unknown): Date | null {
  if (typeof value !== "string") return null
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

function validateField(key: string, value: unknown): string | null {
  switch (key) {
    case "categoryId":
      return parseObjectId(value) ? null : "categoryId inválido"
    case "percentage":
      return typeof value === "number" && Number.isInteger(value) && value >= 1 && value <= 100
        ? null
        : "El porcentaje debe ser un entero de 1 a 100"
    case "startDate":
    case "endDate":
      return parseDate(value) ? null : `${key} debe ser una fecha válida (ej. 2026-12-01)`
    default:
      return null
  }
}

function validate(input: Record<string, unknown>, required: string[]): string | null {
  for (const key of required) {
    if (!(key in input)) return validateField(key, undefined)
  }
  for (const key of Object.keys(input)) {
    const error = validateField(key, input[key])
    if (error) return error
  }
  return null
}

async function categoryExists(categoryId: unknown) {
  return !!(await db.collection("categories").findOne({ _id: parseObjectId(categoryId)! }))
}

async function findAll(req: Request, res: Response) {
  const categoryIdParam = req.query.categoryId
  if (categoryIdParam === undefined) {
    return res.json({ data: await repository.findAll() })
  }
  const categoryId = parseObjectId(categoryIdParam)
  if (!categoryId) {
    return res.status(400).send({ message: "categoryId inválido" })
  }
  return res.json({ data: await repository.findAll({ categoryId }) })
}

async function findOne(req: Request, res: Response) {
  const id = req.params.id as string
  if (!parseObjectId(id)) {
    return res.status(400).send({ message: "Id de descuento inválido" })
  }
  const discount = await repository.findOne({ id })
  if (!discount) {
    return res.status(404).send({ message: "Descuento no encontrado" })
  }
  res.json({ data: discount })
}

async function add(req: Request, res: Response) {
  const input = req.body.sanitizedInput as Record<string, unknown>
  const validationError = validate(input, ["categoryId", "percentage", "startDate", "endDate"])
  if (validationError) {
    return res.status(400).send({ message: validationError })
  }

  const startDate = parseDate(input.startDate)!
  const endDate = parseDate(input.endDate)!
  if (endDate <= startDate) {
    return res.status(400).send({ message: "endDate debe ser posterior a startDate" })
  }
  if (!(await categoryExists(input.categoryId))) {
    return res.status(404).send({ message: "Categoría no encontrada" })
  }

  const discount = await repository.add(
    new Discount(parseObjectId(input.categoryId)!, input.percentage as number, startDate, endDate)
  )
  return res.status(201).send({ message: "Descuento creado", data: discount })
}

async function update(req: Request, res: Response) {
  const id = req.params.id as string
  if (!parseObjectId(id)) {
    return res.status(400).send({ message: "Id de descuento inválido" })
  }

  const input = req.body.sanitizedInput as Record<string, unknown>
  if (Object.keys(input).length === 0) {
    return res.status(400).send({ message: "No hay campos para actualizar" })
  }
  const validationError = validate(input, [])
  if (validationError) {
    return res.status(400).send({ message: validationError })
  }

  const existing = await repository.findOne({ id })
  if (!existing) {
    return res.status(404).send({ message: "Descuento no encontrado" })
  }

  const fields: Partial<Discount> = {}
  if ("categoryId" in input) {
    if (!(await categoryExists(input.categoryId))) {
      return res.status(404).send({ message: "Categoría no encontrada" })
    }
    fields.categoryId = parseObjectId(input.categoryId)!
  }
  if ("percentage" in input) fields.percentage = input.percentage as number
  if ("startDate" in input) fields.startDate = parseDate(input.startDate)!
  if ("endDate" in input) fields.endDate = parseDate(input.endDate)!

  // las fechas se validan combinando lo nuevo con lo que ya estaba guardado
  if ((fields.endDate ?? existing.endDate) <= (fields.startDate ?? existing.startDate)) {
    return res.status(400).send({ message: "endDate debe ser posterior a startDate" })
  }

  const discount = await repository.update(id, fields as Discount)
  return res.status(200).send({ message: "Descuento actualizado", data: discount })
}

async function remove(req: Request, res: Response) {
  const id = req.params.id as string
  if (!parseObjectId(id)) {
    return res.status(400).send({ message: "Id de descuento inválido" })
  }
  const discount = await repository.delete({ id })
  if (!discount) {
    return res.status(404).send({ message: "Descuento no encontrado" })
  }
  res.status(200).send({ message: "Descuento eliminado" })
}

export { sanitizeDiscountInput, findAll, findOne, add, update, remove }
