import { Request, Response, NextFunction } from "express"
import { ProductRepository } from "./product.Repository.js"
import { Product, OUT_OF_STOCK } from "./product.entity.js"
import { db } from "../shared/db/conn.js"
import { parseObjectId } from "../shared/objectId.js"
import { ObjectId } from "mongodb"
import { slugify } from "../shared/slug.js"

const repository = new ProductRepository()

// la foto es opcional: una URL http(s), o texto vacío para quitarla
function validateImage(input: Record<string, unknown>): string | null {
  if (!("image" in input)) return null
  if (typeof input.image !== "string") return "La imagen debe ser una URL"
  const image = input.image.trim()
  if (image !== "" && (!/^https?:\/\/\S+$/i.test(image) || image.length > 500)) {
    return "La imagen debe ser una URL que empiece con http:// o https://"
  }
  return null
}

// el slug sale del nombre y es la URL del producto: dos productos no pueden compartirlo
async function slugTaken(slug: string, exceptId?: string) {
  const other = await repository.findBySlug(slug)
  return !!other && other._id!.toString() !== exceptId
}

function sanitizeProductInput(req: Request, res: Response, next: NextFunction) {
  req.body.sanitizedInput = {
    name: req.body.name,
    description: req.body.description,
    price: req.body.price,
    stock: req.body.stock,
    status: req.body.status,
    categoryId: req.body.categoryId,
    image: req.body.image,
  }

  Object.keys(req.body.sanitizedInput).forEach((key) => {
    if (req.body.sanitizedInput[key] === undefined) {
      delete req.body.sanitizedInput[key]
    }
  })
  next()
}

function validateForCreate(input: Record<string, unknown>): string | null {
  if (!("name" in input) || typeof input.name !== "string" || input.name.trim().length < 1 || input.name.trim().length > 120) {
    return "El nombre es obligatorio"
  }
  if (!("description" in input) || typeof input.description !== "string" || input.description.trim().length < 1 || input.description.trim().length > 500) {
    return "La descripción es obligatoria"
  }
  if (!("price" in input) || typeof input.price !== "number" || !Number.isFinite(input.price) || input.price <= 0) {
    return "El precio debe ser un número mayor a 0"
  }
  if (!("stock" in input) || typeof input.stock !== "number" || !Number.isInteger(input.stock) || input.stock < 0) {
    return "El stock debe ser un entero mayor o igual a 0"
  }
  if (!("status" in input) || typeof input.status !== "string" || input.status.trim().length < 1 || input.status.trim().length > 40) {
    return "El estado es obligatorio"
  }
  if (!("categoryId" in input) || parseObjectId(input.categoryId) === null) {
    return "categoryId inválido"
  }
  return validateImage(input)
}

function validateForUpdate(input: Record<string, unknown>): string | null {
  if ("name" in input) {
    if (typeof input.name !== "string" || input.name.trim().length < 1 || input.name.trim().length > 120) {
      return "El nombre es obligatorio"
    }
  }
  if ("description" in input) {
    if (typeof input.description !== "string" || input.description.trim().length < 1 || input.description.trim().length > 500) {
      return "La descripción es obligatoria"
    }
  }
  if ("price" in input) {
    if (typeof input.price !== "number" || !Number.isFinite(input.price) || input.price <= 0) {
      return "El precio debe ser un número mayor a 0"
    }
  }
  if ("stock" in input) {
    if (typeof input.stock !== "number" || !Number.isInteger(input.stock) || input.stock < 0) {
      return "El stock debe ser un entero mayor o igual a 0"
    }
  }
  if ("status" in input) {
    if (typeof input.status !== "string" || input.status.trim().length < 1 || input.status.trim().length > 40) {
      return "El estado es obligatorio"
    }
  }
  if ("categoryId" in input && parseObjectId(input.categoryId) === null) {
    return "categoryId inválido"
  }
  return validateImage(input)
}

function buildUpdateFields(input: Record<string, unknown>): Partial<Product> {
  const fields: Partial<Product> = {}
  if ("name" in input) {
    fields.name = (input.name as string).trim()
  }
  if ("description" in input) {
    fields.description = (input.description as string).trim()
  }
  if ("price" in input) {
    fields.price = input.price as number
  }
  if ("stock" in input) {
    fields.stock = input.stock as number
  }
  if ("status" in input) {
    fields.status = (input.status as string).trim()
  }
  if ("categoryId" in input) {
    fields.categoryId = parseObjectId(input.categoryId)!
  }
  if ("image" in input) {
    fields.image = (input.image as string).trim()
  }
  // al renombrar cambia la URL del producto
  if (fields.name !== undefined) {
    fields.slug = slugify(fields.name)
  }
  return fields
}

async function findAll(req: Request, res: Response) {
  const categoryIdParam = req.query.categoryId
  if (categoryIdParam === undefined) {
    return res.json({ data: await repository.findAll() })
  }
  const parsed = parseObjectId(categoryIdParam)
  if (!parsed) {
    return res.status(400).send({ message: "categoryId inválido" })
  }
  return res.json({ data: await repository.findAll({ categoryId: parsed }) })
}

async function findOne(req: Request, res: Response) {
  const id = req.params.id as string
  // se busca por id o por slug (la tienda usa el slug en la URL: /productos/rtx-4070)
  const product = parseObjectId(id) ? await repository.findOne({ id }) : await repository.findBySlug(id)
  if (!product) {
    return res.status(404).send({ message: "Producto no encontrado" })
  }
  res.json({ data: product })
}

async function add(req: Request, res: Response) {
  const input = req.body.sanitizedInput as Record<string, unknown>
  const validationError = validateForCreate(input)
  if (validationError) {
    return res.status(400).send({ message: validationError })
  }

  const categoryId = parseObjectId(input.categoryId)!
  const category = await db.collection("categories").findOne({ _id: categoryId })
  if (!category) {
    return res.status(404).send({ message: "Categoría no encontrada" })
  }

  const name = (input.name as string).trim()
  const slug = slugify(name)
  if (await slugTaken(slug)) {
    return res.status(409).send({ message: "Ya existe un producto con ese nombre" })
  }

  const productInput = new Product(
    name,
    (input.description as string).trim(),
    input.price as number,
    input.stock as number,
    input.stock === 0 ? OUT_OF_STOCK : (input.status as string).trim(),
    categoryId,
    slug
  )
  const image = typeof input.image === "string" ? input.image.trim() : ""
  if (image) productInput.image = image

  const product = await repository.add(productInput)
  return res.status(201).send({ message: "Producto creado", data: product })
}

async function update(req: Request, res: Response) {
  const id = req.params.id as string
  if (!parseObjectId(id)) {
    return res.status(400).send({ message: "Id de producto inválido" })
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
    return res.status(404).send({ message: "Producto no encontrado" })
  }

  const fields = buildUpdateFields(input)
  // sin stock, el estado pasa solo a "sin stock" (aunque el cambio sea solo del estado)
  if ((fields.stock ?? existing.stock) === 0) {
    fields.status = OUT_OF_STOCK
  }

  if (fields.slug !== undefined && (await slugTaken(fields.slug, id))) {
    return res.status(409).send({ message: "Ya existe un producto con ese nombre" })
  }

  if ("categoryId" in fields) {
    const category = await db.collection("categories").findOne({ _id: fields.categoryId })
    if (!category) {
      return res.status(404).send({ message: "Categoría no encontrada" })
    }
  }

  const product = await repository.update(id, fields as Product)
  return res.status(200).send({ message: "Producto actualizado", data: product })
}

async function remove(req: Request, res: Response) {
  const id = req.params.id as string
  if (!parseObjectId(id)) {
    return res.status(400).send({ message: "Id de producto inválido" })
  }

  const productId = new ObjectId(id)
  const existing = await repository.findOne({ id })
  if (!existing) {
    return res.status(404).send({ message: "Producto no encontrado" })
  }

  const count = await db.collection("orderItems").countDocuments({ productId })
  if (count > 0) {
    return res.status(409).send({ message: "El producto está referenciado por un ítem de pedido" })
  }

  await repository.delete({ id })
  res.status(200).send({ message: "Producto eliminado" })
}

export { sanitizeProductInput, findAll, findOne, add, update, remove }
