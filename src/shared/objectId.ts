import { ObjectId } from "mongodb"

const HEX_24 = /^[a-f0-9]{24}$/i

export function parseObjectId(value: unknown): ObjectId | null {
  if (typeof value !== "string" || !HEX_24.test(value)) {
    return null
  }
  return new ObjectId(value)
}
