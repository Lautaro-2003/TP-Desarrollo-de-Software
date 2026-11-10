import { Router } from "express";
import { login, me, confirmEmail } from "./auth.controller.js";
import { authenticate } from "./auth.js";
import { sanitizeUserInput, add } from "../user/user.controller.js";

export const authRouter = Router()

// registro público: reutiliza el alta de usuarios, que sin sesión de admin siempre crea un cliente
authRouter.post("/register", sanitizeUserInput, add)
authRouter.post("/login", login)
// el link del mail de confirmación lleva este token
authRouter.get("/confirm/:token", confirmEmail)
authRouter.get("/me", authenticate, me)
