import { Request, Response, NextFunction } from "express"
import { ObjectId } from "mongodb"
import { UserRepository } from "./user.Repository.js"
import { User, USER_ROLES, UserRole } from "./user.entity.js"
import { db } from "../shared/db/conn.js"
import { parseObjectId } from "../shared/objectId.js"

const repository = new UserRepository()

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function sanitizeUserInput(req: Request, res: Response, next: NextFunction) {
  req.body.sanitizedInput = {
    name: req.body.name,
    email: req.body.email,
    address: req.body.address,
    role: req.body.role,
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
  switch (key) {
    case "name":
      if (typeof value !== "string" || value.trim().length < 1 || value.trim().length > 120) {
        return "El nombre es obligatorio (hasta 120 caracteres)"
      }
      return null
    case "email":
      if (typeof value !== "string" || !EMAIL_REGEX.test(value.trim()) || value.trim().length > 254) {
        return "El email no tiene un formato válido"
      }
      return null
    case "address":
      if (typeof value !== "string" || value.trim().length < 1 || value.trim().length > 200) {
        return "La dirección es obligatoria (hasta 200 caracteres)"
      }
      return null
    case "role":
      if (typeof value !== "string" || !USER_ROLES.includes(value as UserRole)) {
        return `El rol debe ser uno de: ${USER_ROLES.join(", ")}`
      }
      return null
    default:
      return null
  }
}

function validateForCreate(input: Record<string, unknown>): string | null {
  for (const key of ["name", "email", "address"]) {
    if (!(key in input)) {
      return validateField(key, undefined)
    }
  }
  for (const key of Object.keys(input)) {
    const error = validateField(key, input[key])
    if (error) return error
  }
  return null
}

function validateForUpdate(input: Record<string, unknown>): string | null {
  for (const key of Object.keys(input)) {
    const error = validateField(key, input[key])
    if (error) return error
  }
  return null
}

// normaliza los campos: recorta espacios y guarda el email en minúsculas
function buildFields(input: Record<string, unknown>): Partial<User> {
  const fields: Partial<User> = {}
  if ("name" in input) fields.name = (input.name as string).trim()
  if ("email" in input) fields.email = (input.email as string).trim().toLowerCase()
  if ("address" in input) fields.address = (input.address as string).trim()
  if ("role" in input) fields.role = input.role as UserRole
  return fields
}

async function emailTaken(email: string, exceptId?: string): Promise<boolean> {
  const existing = await repository.findByEmail(email)
  return !!existing && existing._id?.toString() !== exceptId
}

async function findAll(req: Request, res: Response) {
  res.json({ data: await repository.findAll() })
}

async function findOne(req: Request, res: Response) {
  const id = req.params.id as string
  if (!parseObjectId(id)) {
    return res.status(400).send({ message: "Id de usuario inválido" })
  }
  const user = await repository.findOne({ id })
  if (!user) {
    return res.status(404).send({ message: "Usuario no encontrado" })
  }
  res.json({ data: user })
}

async function add(req: Request, res: Response) {
  const input = req.body.sanitizedInput as Record<string, unknown>
  const validationError = validateForCreate(input)
  if (validationError) {
    return res.status(400).send({ message: validationError })
  }

  const fields = buildFields(input)
  if (await emailTaken(fields.email!)) {
    return res.status(409).send({ message: "Ya existe un usuario con ese email" })
  }

  // si no se indica rol, el usuario se registra como cliente
  const userInput = new User(fields.name!, fields.email!, fields.address!, fields.role ?? "cliente")
  const user = await repository.add(userInput)
  return res.status(201).send({ message: "Usuario creado", data: user })
}

async function update(req: Request, res: Response) {
  const id = req.params.id as string
  if (!parseObjectId(id)) {
    return res.status(400).send({ message: "Id de usuario inválido" })
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
    return res.status(404).send({ message: "Usuario no encontrado" })
  }

  const fields = buildFields(input)
  if (fields.email && (await emailTaken(fields.email, id))) {
    return res.status(409).send({ message: "Ya existe un usuario con ese email" })
  }

  const user = await repository.update(id, fields as User)
  return res.status(200).send({ message: "Usuario actualizado", data: user })
}

async function remove(req: Request, res: Response) {
  const id = req.params.id as string
  if (!parseObjectId(id)) {
    return res.status(400).send({ message: "Id de usuario inválido" })
  }

  const existing = await repository.findOne({ id })
  if (!existing) {
    return res.status(404).send({ message: "Usuario no encontrado" })
  }

  // no se borra un usuario con pedidos: se perdería el historial de compras
  const orders = await db.collection("orders").countDocuments({ userId: new ObjectId(id) })
  if (orders > 0) {
    return res.status(409).send({ message: "El usuario tiene pedidos registrados" })
  }

  await repository.delete({ id })
  res.status(200).send({ message: "Usuario eliminado" })
}

export { sanitizeUserInput, findAll, findOne, add, update, remove }
