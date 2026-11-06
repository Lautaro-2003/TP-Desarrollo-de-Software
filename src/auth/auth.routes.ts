import { Router } from "express";
import { login, me } from "./auth.controller.js";
import { authenticate } from "./auth.js";
import { sanitizeUserInput, add } from "../user/user.controller.js";

export const authRouter = Router()

// registro público: reutiliza el alta de usuarios, que sin sesión de admin siempre crea un cliente
authRouter.post("/register", sanitizeUserInput, add)
authRouter.post("/login", login)
authRouter.get("/me", authenticate, me)
