import { Router } from "express";
import { sanitizeUserInput, findAll, findOne, add, update, remove } from "./user.controller.js";
import { authenticate, requireRole } from "../auth/auth.js";

export const userRouter = Router()

// el cliente puede ver y modificar su propio usuario (lo valida el controlador); el resto es solo para admin
userRouter.use(authenticate)
userRouter.get("/", requireRole("admin"), findAll)
userRouter.get("/:id", findOne)
userRouter.post("/", requireRole("admin"), sanitizeUserInput, add)
userRouter.put('/:id', sanitizeUserInput, update)
userRouter.patch('/:id', sanitizeUserInput, update)
userRouter.delete('/:id', requireRole("admin"), remove)
