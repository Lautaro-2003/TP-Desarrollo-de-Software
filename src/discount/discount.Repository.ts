import { Repository } from '../shared/repository.js'
import { Discount } from './discount.entity.js'
import { db } from '../shared/db/conn.js'
import { roundCents } from '../shared/money.js'
import { ObjectId } from 'mongodb'

const discounts = db.collection<Discount>('discounts')

await discounts.createIndex({ categoryId: 1, startDate: 1, endDate: 1 })

// precio con descuento redondeado al centavo (percentage 0 = sin descuento)
export function applyDiscount(price: number, percentage: number): number {
  return roundCents((price * (100 - percentage)) / 100)
}

export class DiscountRepository implements Repository<Discount> {
  public async findAll(filter?: { categoryId?: ObjectId }): Promise<Discount[] | undefined> {
    if (filter?.categoryId) {
      return await discounts.find({ categoryId: filter.categoryId }).toArray()
    }
    return await discounts.find().toArray()
  }

  public async findOne(item: { id: string }): Promise<Discount | undefined> {
    const _id = new ObjectId(item.id)
    return (await discounts.findOne({ _id })) || undefined
  }

  public async add(item: Discount): Promise<Discount | undefined> {
    item._id = (await discounts.insertOne(item)).insertedId
    return item
  }

  public async update(id: string, item: Discount): Promise<Discount | undefined> {
    const _id = new ObjectId(id)
    return (await discounts.findOneAndUpdate({ _id }, { $set: item }, { returnDocument: 'after' })) || undefined
  }

  public async delete(item: { id: string }): Promise<Discount | undefined> {
    const _id = new ObjectId(item.id)
    return (await discounts.findOneAndDelete({ _id })) || undefined
  }

  // mayor porcentaje vigente por categoría (clave: categoryId como string); si hay varios vigentes gana el mayor
  public async bestActive(categoryIds: ObjectId[], date = new Date()): Promise<Map<string, number>> {
    const active = await discounts
      .find({ categoryId: { $in: categoryIds }, startDate: { $lte: date }, endDate: { $gt: date } })
      .toArray()
    const best = new Map<string, number>()
    for (const d of active) {
      const key = d.categoryId.toString()
      best.set(key, Math.max(best.get(key) ?? 0, d.percentage))
    }
    return best
  }
}
