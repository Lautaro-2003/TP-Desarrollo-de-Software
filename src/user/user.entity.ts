import { ObjectId } from "mongodb"

export const USER_ROLES = ["cliente", "admin"] as const
export type UserRole = (typeof USER_ROLES)[number]

export class User {
  // hash scrypt de la contraseña; el repositorio nunca lo devuelve en las respuestas
  declare passwordHash?: string
  // false hasta que abre el link del mail; los usuarios viejos y los del seed no tienen el campo y entran igual
  declare emailConfirmed?: boolean
  // token del link de confirmación; se borra al confirmar y nunca sale en las respuestas
  declare emailToken?: string

  constructor(
    public name: string,
    public email: string,
    public address: string,
    public role: UserRole,
    public _id?: ObjectId
  ) {}
}
