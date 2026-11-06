import { Router } from "express";
import { sanitizeReviewInput, findAll, findOne, add, update, remove } from "./review.controller.js";
import { authenticate } from "../auth/auth.js";

export const reviewRouter = Router()

// leer reseñas es público; escribir requiere sesión

reviewRouter.get("/", findAll)
reviewRouter.get("/:id", findOne)
reviewRouter.post("/", authenticate, sanitizeReviewInput, add)
reviewRouter.put('/:id', authenticate, sanitizeReviewInput, update)
reviewRouter.patch('/:id', authenticate, sanitizeReviewInput, update)
reviewRouter.delete('/:id', authenticate, remove)
