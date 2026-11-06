import { Repository } from '../shared/repository.js'
import { Order } from './order.entity.js'
import { db } from '../shared/db/conn.js'
import { ObjectId } from 'mongodb'

const orders = db.collection<Order>('orders')
const orderItems = db.collection('orderItems')

await orders.createIndex({ userId: 1 })
await orderItems.createIndex({ orderId: 1 })

export class OrderRepository implements Repository<Order> {
  public async findAll(filter?: { userId?: ObjectId }): Promise<Order[] | undefined> {
    if (filter?.userId) {
      return await orders.find({ userId: filter.userId }).toArray()
    }
    return await orders.find().toArray()
  }

  public async findOne(item: { id: string }): Promise<Order | undefined> {
    const _id = new ObjectId(item.id)
    return (await orders.findOne({ _id })) || undefined
  }

  public async add(item: Order): Promise<Order | undefined> {
    item._id = (await orders.insertOne(item)).insertedId
    return item
  }

  public async update(id: string, item: Order): Promise<Order | undefined> {
    const _id = new ObjectId(id)
    return (await orders.findOneAndUpdate({ _id }, { $set: item }, { returnDocument: 'after' })) || undefined
  }

  // borra el pedido junto con sus ítems
  public async delete(item: { id: string }): Promise<Order | undefined> {
    const _id = new ObjectId(item.id)
    await orderItems.deleteMany({ orderId: _id })
    return (await orders.findOneAndDelete({ _id })) || undefined
  }

  // el total se guarda en el pedido y se recalcula sumando los subtotales de sus ítems
  public async recalculateTotal(orderId: ObjectId): Promise<void> {
    const [result] = await orderItems
      .aggregate<{ total: number }>([
        { $match: { orderId } },
        { $group: { _id: null, total: { $sum: '$subtotal' } } },
      ])
      .toArray()
    await orders.updateOne({ _id: orderId }, { $set: { total: result?.total ?? 0 } })
  }
}
