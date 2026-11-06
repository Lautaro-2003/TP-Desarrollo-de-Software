import { Router } from "express";
import { sanitizeDiscountInput, findAll, findOne, add, update, remove } from "./discount.controller.js";
import { authenticate, requireRole } from "../auth/auth.js";

export const discountRouter = Router()

// consultar es público; dar de alta, modificar y borrar es solo para admin
const admin = [authenticate, requireRole("admin")]

discountRouter.get("/", findAll)
discountRouter.get("/:id", findOne)
discountRouter.post("/", ...admin, sanitizeDiscountInput, add)
discountRouter.put('/:id', ...admin, sanitizeDiscountInput, update)
discountRouter.patch('/:id', ...admin, sanitizeDiscountInput, update)
discountRouter.delete('/:id', ...admin, remove)
