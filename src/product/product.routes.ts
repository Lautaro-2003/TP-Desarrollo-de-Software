import { Router } from "express";
import { sanitizeProductInput, findAll, findOne, add, update, remove } from "./product.controller.js";
import { authenticate, requireRole } from "../auth/auth.js";

export const productRouter = Router()

// consultar es público; dar de alta, modificar y borrar es solo para admin
const admin = [authenticate, requireRole("admin")]

productRouter.get("/", findAll)
productRouter.get("/:id", findOne)
productRouter.post("/", ...admin, sanitizeProductInput, add)
productRouter.put('/:id', ...admin, sanitizeProductInput, update)
productRouter.patch('/:id', ...admin, sanitizeProductInput, update)
productRouter.delete('/:id', ...admin, remove)
