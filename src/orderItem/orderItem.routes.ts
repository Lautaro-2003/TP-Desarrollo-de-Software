import { Router } from "express";
import { sanitizeOrderItemInput, findAll, findOne, add, update, remove } from "./orderItem.controller.js";
import { authenticate, requireRole } from "../auth/auth.js";

export const orderItemRouter = Router()

// gestión manual de ítems: solo admin. El cliente arma su pedido con el checkout y ve los ítems en GET /api/orders/:id
orderItemRouter.use(authenticate, requireRole("admin"))

orderItemRouter.get("/", findAll)
orderItemRouter.get("/:id", findOne)
orderItemRouter.post("/", sanitizeOrderItemInput, add)
orderItemRouter.put('/:id', sanitizeOrderItemInput, update)
orderItemRouter.patch('/:id', sanitizeOrderItemInput, update)
orderItemRouter.delete('/:id', remove)
