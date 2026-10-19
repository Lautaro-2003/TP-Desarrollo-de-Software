import { ObjectId } from "mongodb"

// shortcut: price and subtotal are JS numbers, switch to integer cents if a payment provider is added
export class Product {
  constructor(
    public name: string,
    public description: string,
    public price: number,
    public stock: number,
    public status: string,
    public categoryId: ObjectId,
    public _id?: ObjectId
  ) {}
}
