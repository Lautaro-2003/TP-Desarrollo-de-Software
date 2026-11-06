import { ObjectId } from "mongodb"

export const ORDER_STATUSES = ["pendiente", "pagado", "enviado", "entregado"] as const
export type OrderStatus = (typeof ORDER_STATUSES)[number]

// un pedido solo avanza al estado siguiente; entregado es el estado final
export const NEXT_STATUS: Partial<Record<OrderStatus, OrderStatus>> = {
  pendiente: "pagado",
  pagado: "enviado",
  enviado: "entregado",
}

export class Order {
  constructor(
    public userId: ObjectId,
    public date: Date,
    public status: OrderStatus,
    public total: number,
    public _id?: ObjectId
  ) {}
}
