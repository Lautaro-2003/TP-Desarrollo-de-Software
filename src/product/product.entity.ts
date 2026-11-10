import { ObjectId } from "mongodb"

// estado que toma un producto cuando su stock llega a cero (lo fija el sistema)
export const OUT_OF_STOCK = "sin stock"

export class Product {
  // promedio de reseñas: lo calcula el sistema; no existe mientras el producto no tenga reseñas.
  // "declare" evita que el constructor cree el campo vacío (MongoDB lo guardaría como null)
  declare rating?: { average: number; count: number }
  // URL de la foto; opcional: sin foto la tienda muestra la huella serigrafiada
  declare image?: string

  constructor(
    public name: string,
    public description: string,
    public price: number,
    public stock: number,
    public status: string,
    public categoryId: ObjectId,
    // identificador legible para la URL, derivado del nombre y único
    public slug: string,
    public _id?: ObjectId
  ) {}
}
