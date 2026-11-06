import { Request, Response, NextFunction } from "express"
import { scrypt, randomBytes, timingSafeEqual } from "node:crypto"
import { promisify } from "node:util"
import { SignJWT, jwtVerify } from "jose"
import { UserRole } from "../user/user.entity.js"

export type AuthUser = { id: string; role: UserRole }

// req.user queda cargado por authenticate con el usuario del token
declare global {
  namespace Express {
    interface Request {
      user?: AuthUser
    }
  }
}

const scryptAsync = promisify(scrypt) as (password: string, salt: string, keylen: number) => Promise<Buffer>

const secretValue = process.env.JWT_SECRET
if (!secretValue) {
  throw new Error("JWT_SECRET es obligatorio")
}
const secret = new TextEncoder().encode(secretValue)

// la contraseña se guarda como "sal:hash" (scrypt), nunca en texto plano
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString("hex")
  const hash = await scryptAsync(password, salt, 64)
  return `${salt}:${hash.toString("hex")}`
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [salt, hash] = stored.split(":")
  const candidate = await scryptAsync(password, salt, 64)
  // comparación en tiempo constante para no filtrar información por el tiempo de respuesta
  return timingSafeEqual(candidate, Buffer.from(hash, "hex"))
}

// shortcut: el rol viaja en el token, así que un cambio de rol o una baja recién aplica al vencer (8 h); agregar lista de revocación si hiciera falta
export async function signToken(user: AuthUser): Promise<string> {
  return await new SignJWT({ role: user.role })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(user.id)
    .setIssuedAt()
    .setExpirationTime("8h")
    .sign(secret)
}

// exige un token válido en el header Authorization: Bearer <token>
export async function authenticate(req: Request, res: Response, next: NextFunction) {
  const [scheme, token] = (req.headers.authorization ?? "").split(" ")
  if (scheme !== "Bearer" || !token) {
    return res.status(401).send({ message: "Tenés que iniciar sesión" })
  }
  try {
    const { payload } = await jwtVerify(token, secret, { algorithms: ["HS256"] })
    req.user = { id: payload.sub!, role: payload.role as UserRole }
    next()
  } catch {
    return res.status(401).send({ message: "La sesión no es válida o venció; volvé a iniciar sesión" })
  }
}

export function requireRole(...roles: UserRole[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).send({ message: "No tenés permiso para esta acción" })
    }
    next()
  }
}

export const isAdmin = (req: Request) => req.user?.role === "admin"

// el administrador puede actuar sobre cualquier recurso; el cliente solo sobre los suyos
export const canAccess = (req: Request, ownerId: unknown) => isAdmin(req) || String(ownerId) === req.user?.id
