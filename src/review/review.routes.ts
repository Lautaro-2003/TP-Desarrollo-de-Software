import { Router } from "express";
import { sanitizeReviewInput, findAll, findOne, add, update, remove } from "./review.controler.js";

export const reviewRouter = Router()

reviewRouter.get("/", findAll)
reviewRouter.get("/:id", findOne)
reviewRouter.post("/", sanitizeReviewInput, add)
reviewRouter.put('/:id', sanitizeReviewInput, update)
reviewRouter.patch('/:id', sanitizeReviewInput, update)
reviewRouter.delete('/:id', remove)
