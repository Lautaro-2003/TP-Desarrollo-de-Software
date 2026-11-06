import { ObjectId } from "mongodb"

export const USER_ROLES = ["cliente", "admin"] as const
export type UserRole = (typeof USER_ROLES)[number]

export class User {
  constructor(
    public name: string,
    public email: string,
    public address: string,
    public role: UserRole,
    public _id?: ObjectId
  ) {}
}
