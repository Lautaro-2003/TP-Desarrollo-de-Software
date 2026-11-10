import { Request, Response, NextFunction } from "express"
import { ObjectId } from "mongodb"
import { CategoryRepository } from "./category.Repository.js"
import { Category } from "./category.entity.js"
import { db } from "../shared/db/conn.js"
import { parseObjectId } from "../shared/objectId.js"
import { slugify } from "../shared/slug.js"

const repository = new CategoryRepository()

// el slug sale del nombre y va en la URL del catálogo (/?categoria=placas-de-video): dos categorías no pueden compartirlo
async function slugTaken(slug: string, exceptId?: string) {
  const other = await repository.findBySlug(slug)
  return !!other && other._id!.toString() !== exceptId
}

function sanitizeCategoryInput(req: Request, res: Response, next: NextFunction) {
  req.body.sanitizedInput = {
    name: req.body.name,
    description: req.body.description,
  }

  Object.keys(req.body.sanitizedInput).forEach((key) => {
    if (req.body.sanitizedInput[key] === undefined) {
      delete req.body.sanitizedInput[key]
    }
  })
  next()
}

// valida un campo puntual; devuelve el mensaje de error o null si es válido
function validateField(key: string, value: unknown): string | null {
  if (key === "name" && (typeof value !== "string" || value.trim().length < 1 || value.trim().length > 80)) {
    return "El nombre es obligatorio (hasta 80 caracteres)"
  }
  if (key === "description" && (typeof value !== "string" || value.trim().length < 1 || value.trim().length > 500)) {
    return "La descripción es obligatoria (hasta 500 caracteres)"
  }
  return null
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

function buildFields(input: Record<string, unknown>): Partial<Category> {
  const fields: Partial<Category> = {}
  if ("name" in input) fields.name = (input.name as string).trim()
  if ("description" in input) fields.description = (input.description as string).trim()
  // al renombrar cambia la URL de la categoría
  if (fields.name !== undefined) fields.slug = slugify(fields.name, "categoria")
  return fields
}

async function findAll(req: Request, res: Response) {
  res.json({ data: await repository.findAll() })
}

async function findOne(req: Request, res: Response) {
  const id = req.params.id as string
  if (!parseObjectId(id)) {
    return res.status(400).send({ message: "Id de categoría inválido" })
  }
  const category = await repository.findOne({ id })
  if (!category) {
    return res.status(404).send({ message: "Categoría no encontrada" })
  }
  res.json({ data: category })
}

async function add(req: Request, res: Response) {
  const input = req.body.sanitizedInput as Record<string, unknown>
  const validationError = validate(input, ["name", "description"])
  if (validationError) {
    return res.status(400).send({ message: validationError })
  }

  const fields = buildFields(input)
  if (await slugTaken(fields.slug!)) {
    return res.status(409).send({ message: "Ya existe una categoría con ese nombre" })
  }
  const category = await repository.add(new Category(fields.name!, fields.description!, fields.slug!))
  return res.status(201).send({ message: "Categoría creada", data: category })
}

async function update(req: Request, res: Response) {
  const id = req.params.id as string
  if (!parseObjectId(id)) {
    return res.status(400).send({ message: "Id de categoría inválido" })
  }

  const input = req.body.sanitizedInput as Record<string, unknown>
  if (Object.keys(input).length === 0) {
    return res.status(400).send({ message: "No hay campos para actualizar" })
  }
  const validationError = validate(input, [])
  if (validationError) {
    return res.status(400).send({ message: validationError })
  }

  const fields = buildFields(input)
  if (fields.slug !== undefined && (await slugTaken(fields.slug, id))) {
    return res.status(409).send({ message: "Ya existe una categoría con ese nombre" })
  }
  const category = await repository.update(id, fields as Category)
  if (!category) {
    return res.status(404).send({ message: "Categoría no encontrada" })
  }
  return res.status(200).send({ message: "Categoría actualizada", data: category })
}

async function remove(req: Request, res: Response) {
  const id = req.params.id as string
  if (!parseObjectId(id)) {
    return res.status(400).send({ message: "Id de categoría inválido" })
  }

  const existing = await repository.findOne({ id })
  if (!existing) {
    return res.status(404).send({ message: "Categoría no encontrada" })
  }

  // un producto no puede existir sin categoría (CRUD dependiente)
  const products = await db.collection("products").countDocuments({ categoryId: new ObjectId(id) })
  if (products > 0) {
    return res.status(409).send({ message: "La categoría tiene productos asociados" })
  }
  // los descuentos también dependen de la categoría
  const discounts = await db.collection("discounts").countDocuments({ categoryId: new ObjectId(id) })
  if (discounts > 0) {
    return res.status(409).send({ message: "La categoría tiene descuentos asociados" })
  }

  await repository.delete({ id })
  res.status(200).send({ message: "Categoría eliminada" })
}

export { sanitizeCategoryInput, findAll, findOne, add, update, remove }
