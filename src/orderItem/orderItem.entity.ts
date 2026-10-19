import { ObjectId } from "mongodb"

export class OrderItem {
  constructor(
    public orderId: ObjectId,
    public productId: ObjectId,
    public quantity: number,
    public unitPrice: number,
    public subtotal: number,
    public _id?: ObjectId
  ) {}
}
