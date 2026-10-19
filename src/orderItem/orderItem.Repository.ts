import { Repository } from '../shared/repository.js'
import { OrderItem } from './orderItem.entity.js'
import { db } from '../shared/db/conn.js'
import { ObjectId } from 'mongodb'

const orderItems = db.collection<OrderItem>('orderItems')

export class OrderItemRepository implements Repository<OrderItem> {
  public async findAll(): Promise<OrderItem[] | undefined> {
    return await orderItems.find().toArray()
  }

  public async findOne(item: { id: string }): Promise<OrderItem | undefined> {
    const _id = new ObjectId(item.id)
    return (await orderItems.findOne({ _id })) || undefined
  }

  public async add(item: OrderItem): Promise<OrderItem | undefined> {
    item._id = (await orderItems.insertOne(item)).insertedId
    return item
  }

  public async update(id: string, item: OrderItem): Promise<OrderItem | undefined> {
    const _id = new ObjectId(id)
    return (await orderItems.findOneAndUpdate({ _id }, { $set: item }, { returnDocument: 'after' })) || undefined
  }

  public async delete(item: { id: string }): Promise<OrderItem | undefined> {
    const _id = new ObjectId(item.id)
    return (await orderItems.findOneAndDelete({ _id })) || undefined
  }
}
