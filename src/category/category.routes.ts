import { Router } from "express";
import { sanitizeCategoryInput, findAll, findOne, add, update, remove } from "./category.controller.js";
import { authenticate, requireRole } from "../auth/auth.js";

export const categoryRouter = Router()

// consultar es público; dar de alta, modificar y borrar es solo para admin
const admin = [authenticate, requireRole("admin")]

categoryRouter.get("/", findAll)
categoryRouter.get("/:id", findOne)
categoryRouter.post("/", ...admin, sanitizeCategoryInput, add)
categoryRouter.put('/:id', ...admin, sanitizeCategoryInput, update)
categoryRouter.patch('/:id', ...admin, sanitizeCategoryInput, update)
categoryRouter.delete('/:id', ...admin, remove)