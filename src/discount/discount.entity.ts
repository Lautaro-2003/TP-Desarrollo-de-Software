import { ObjectId } from "mongodb"

// descuento porcentual sobre los productos de una categoría; vigente si startDate <= ahora < endDate
export class Discount {
  constructor(
    public categoryId: ObjectId,
    public percentage: number,
    public startDate: Date,
    public endDate: Date,
    public _id?: ObjectId
  ) {}
}
