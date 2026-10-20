import { Request, Response, NextFunction } from "express"
import { CategoryRepository } from "./category.Repository.js"
import { Category } from "./category.entity.js"

const repository = new CategoryRepository()

function sanitizeCategoryInput(req: Request, res: Response, next: NextFunction) {
  req.body.sanitizedInput = {
    name: req.body.name,
    description: req.body.description,
  }
  // más validaciones acá

  Object.keys(req.body.sanitizedInput).forEach((key) => {
    if (req.body.sanitizedInput[key] === undefined) {
      delete req.body.sanitizedInput[key]
    }
  })
  next()
}

async function findAll(req: Request, res: Response) {
  res.json({ data: await repository.findAll() })
}

async function findOne(req: Request, res: Response) {
  const id = req.params.id as string
  const category = await repository.findOne({ id })
  if (!category) {
    return res.status(404).send({ message: "Categoría no encontrada" })
  }
  res.json({ data: category })
}

async function add(req: Request, res: Response) {
  const input = req.body.sanitizedInput

  const categoryInput = new Category(input.name, input.description)

  const category = await repository.add(categoryInput)
  return res.status(201).send({ message: "Categoría creada", data: category })
}

async function update(req: Request, res: Response) {
  const id = req.params.id as string
  const category = await repository.update(id, req.body.sanitizedInput)

  if (!category) {
    return res.status(404).send({ message: "Categoría no encontrada" })
  }

  return res.status(200).send({ message: "Categoría actualizada", data: category })
}

async function remove(req: Request, res: Response) {
  const id = req.params.id as string
  const category = await repository.delete({ id })

  if (!category) {
    res.status(404).send({ message: "Categoría no encontrada" })
  } else {
    res.status(200).send({ message: "Categoría eliminada" })
  }
}

export { sanitizeCategoryInput, findAll, findOne, add, update, remove }