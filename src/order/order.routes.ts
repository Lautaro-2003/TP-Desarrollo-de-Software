import { Router } from "express";
import { sanitizeOrderInput, findAll, findOne, add, update, remove, checkout, changeStatus } from "./order.controler.js";

export const orderRouter = Router()

orderRouter.post("/checkout", checkout)
orderRouter.patch("/:id/status", changeStatus)
orderRouter.get("/", findAll)
orderRouter.get("/:id", findOne)
orderRouter.post("/", sanitizeOrderInput, add)
orderRouter.put('/:id', sanitizeOrderInput, update)
orderRouter.patch('/:id', sanitizeOrderInput, update)
orderRouter.delete('/:id', remove)
