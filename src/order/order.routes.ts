import { Router } from "express";
import { sanitizeOrderInput, findAll, findOne, add, update, remove, checkout, changeStatus } from "./order.controller.js";
import { authenticate, requireRole } from "../auth/auth.js";

export const orderRouter = Router()

// todo requiere sesión; el controlador limita al cliente a sus propios pedidos
orderRouter.use(authenticate)

orderRouter.post("/checkout", checkout)
orderRouter.patch("/:id/status", changeStatus)
orderRouter.get("/", findAll)
orderRouter.get("/:id", findOne)
orderRouter.post("/", sanitizeOrderInput, add)
orderRouter.put('/:id', requireRole("admin"), sanitizeOrderInput, update)
orderRouter.patch('/:id', requireRole("admin"), sanitizeOrderInput, update)
orderRouter.delete('/:id', remove)
