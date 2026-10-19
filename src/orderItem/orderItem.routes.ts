import { Router } from "express";
import { sanitizeOrderItemInput, findAll, findOne, add, update, remove } from "./orderItem.controler.js";

export const orderItemRouter = Router()

orderItemRouter.get("/", findAll)
orderItemRouter.get("/:id", findOne)
orderItemRouter.post("/", sanitizeOrderItemInput, add)
orderItemRouter.put('/:id', sanitizeOrderItemInput, update)
orderItemRouter.patch('/:id', sanitizeOrderItemInput, update)
orderItemRouter.delete('/:id', remove)
