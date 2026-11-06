import { ObjectId } from "mongodb"

export class Review {
  constructor(
    public userId: ObjectId,
    public productId: ObjectId,
    public rating: number,
    public comment: string,
    public date: Date,
    public _id?: ObjectId
  ) {}
}
