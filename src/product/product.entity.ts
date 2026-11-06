import { ObjectId } from "mongodb"

// atajo: el precio y el subtotal son números de JS; pasar a centavos enteros si se agrega un medio de pago
export class Product {
  // promedio de reseñas: lo calcula el sistema; no existe mientras el producto no tenga reseñas.
  // "declare" evita que el constructor cree el campo vacío (MongoDB lo guardaría como null)
  declare rating?: { average: number; count: number }

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
