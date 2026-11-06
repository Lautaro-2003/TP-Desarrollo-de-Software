import { ObjectId } from "mongodb"

export const USER_ROLES = ["cliente", "admin"] as const
export type UserRole = (typeof USER_ROLES)[number]

export class User {
  // hash scrypt de la contraseña; el repositorio nunca lo devuelve en las respuestas
  declare passwordHash?: string

  constructor(
    public name: string,
    public email: string,
    public address: string,
    public role: UserRole,
    public _id?: ObjectId
  ) {}
}
