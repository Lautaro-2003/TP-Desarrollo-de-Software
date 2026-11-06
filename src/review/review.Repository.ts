import { Repository } from '../shared/repository.js'
import { Review } from './review.entity.js'
import { Order } from '../order/order.entity.js'
import { OrderItem } from '../orderItem/orderItem.entity.js'
import { Product } from '../product/product.entity.js'
import { db } from '../shared/db/conn.js'
import { ObjectId } from 'mongodb'

const reviews = db.collection<Review>('reviews')
const orders = db.collection<Order>('orders')
const orderItems = db.collection<OrderItem>('orderItems')
const products = db.collection<Product>('products')

// un usuario deja una sola reseña por producto
await reviews.createIndex({ userId: 1, productId: 1 }, { unique: true })
await reviews.createIndex({ productId: 1 })

export class ReviewRepository implements Repository<Review> {
  public async findAll(filter?: { productId?: ObjectId }): Promise<Review[] | undefined> {
    if (filter?.productId) {
      return await reviews.find({ productId: filter.productId }).toArray()
    }
    return await reviews.find().toArray()
  }

  public async findOne(item: { id: string }): Promise<Review | undefined> {
    const _id = new ObjectId(item.id)
    return (await reviews.findOne({ _id })) || undefined
  }

  public async add(item: Review): Promise<Review | undefined> {
    item._id = (await reviews.insertOne(item)).insertedId
    return item
  }

  public async update(id: string, item: Review): Promise<Review | undefined> {
    const _id = new ObjectId(id)
    return (await reviews.findOneAndUpdate({ _id }, { $set: item }, { returnDocument: 'after' })) || undefined
  }

  public async delete(item: { id: string }): Promise<Review | undefined> {
    const _id = new ObjectId(item.id)
    return (await reviews.findOneAndDelete({ _id })) || undefined
  }

  // compró = tiene un pedido ya pagado (pagado, enviado o entregado) que incluye el producto
  public async hasPurchased(userId: ObjectId, productId: ObjectId): Promise<boolean> {
    const paidOrders = await orders.find({ userId, status: { $ne: 'pendiente' } }, { projection: { _id: 1 } }).toArray()
    const count = await orderItems.countDocuments({ productId, orderId: { $in: paidOrders.map((o) => o._id) } }, { limit: 1 })
    return count > 0
  }

  // el promedio se guarda en el producto para mostrarlo en la tienda sin recalcularlo en cada lectura
  public async recalculateProductRating(productId: ObjectId): Promise<void> {
    const [result] = await reviews
      .aggregate<{ average: number; count: number }>([
        { $match: { productId } },
        { $group: { _id: null, average: { $avg: '$rating' }, count: { $sum: 1 } } },
      ])
      .toArray()
    if (!result) {
      await products.updateOne({ _id: productId }, { $unset: { rating: '' } })
      return
    }
    const rating = { average: Math.round(result.average * 10) / 10, count: result.count }
    await products.updateOne({ _id: productId }, { $set: { rating } })
  }
}
