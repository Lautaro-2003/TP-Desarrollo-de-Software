import { ObjectId } from "mongodb"

export const ORDER_STATUSES = ["pendiente", "pagado", "enviado", "entregado"] as const
export type OrderStatus = (typeof ORDER_STATUSES)[number]

export class Order {
  constructor(
    public userId: ObjectId,
    public date: Date,
    public status: OrderStatus,
    public total: number,
    public _id?: ObjectId
  ) {}
}
