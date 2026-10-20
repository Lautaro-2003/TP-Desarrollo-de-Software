import { ObjectId } from "mongodb"

// atajo: el precio y el subtotal son números de JS; pasar a centavos enteros si se agrega un medio de pago
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
