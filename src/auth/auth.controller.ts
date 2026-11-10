import { Request, Response } from "express"
import { UserRepository } from "../user/user.Repository.js"
import { signToken, verifyPassword } from "./auth.js"
import { sendConfirmationEmail } from "../shared/mailer.js"

const repository = new UserRepository()

async function login(req: Request, res: Response) {
  const { email, password } = req.body
  if (typeof email !== "string" || typeof password !== "string") {
    return res.status(400).send({ message: "Email y contraseña son obligatorios" })
  }

  const user = await repository.findByEmailWithPassword(email.trim().toLowerCase())
  // mismo mensaje si el email no existe o la contraseña no coincide: no se revela qué emails están registrados
  if (!user?.passwordHash || !(await verifyPassword(password, user.passwordHash))) {
    return res.status(401).send({ message: "Email o contraseña incorrectos" })
  }

  // solo se bloquea a quien se registró con confirmación pendiente; se le reenvía el link por si no le llegó
  if (user.emailConfirmed === false) {
    try {
      await sendConfirmationEmail(user.email, user.name, user.emailToken!)
    } catch (err) {
      console.error("No se pudo reenviar el mail de confirmación", err)
    }
    return res.status(403).send({ message: `Confirmá tu email: te reenviamos el link a ${user.email}` })
  }

  const { passwordHash, emailToken, ...data } = user
  const token = await signToken({ id: user._id!.toString(), role: user.role })
  return res.json({ message: "Sesión iniciada", data: { token, user: data } })
}

async function confirmEmail(req: Request, res: Response) {
  const user = await repository.confirmEmail(req.params.token as string)
  if (!user) {
    return res.status(404).send({ message: "El link de confirmación no es válido o ya se usó" })
  }
  res.json({ message: "Email confirmado: ya podés ingresar", data: user })
}

async function me(req: Request, res: Response) {
  const user = await repository.findOne({ id: req.user!.id })
  if (!user) {
    return res.status(404).send({ message: "Usuario no encontrado" })
  }
  res.json({ data: user })
}

export { login, me, confirmEmail }
