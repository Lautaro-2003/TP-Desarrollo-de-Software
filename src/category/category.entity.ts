import { ObjectId } from "mongodb"

export class Category {
  constructor(
    public name: string,
    public description: string,
    public _id?: ObjectId
  ) {}
}
