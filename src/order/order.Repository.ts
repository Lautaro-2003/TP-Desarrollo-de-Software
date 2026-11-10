import { Repository } from '../shared/repository.js'
import { Order, OrderStatus } from './order.entity.js'
import { OrderItem } from '../orderItem/orderItem.entity.js'
import { Product, OUT_OF_STOCK } from '../product/product.entity.js'
import { cli, db } from '../shared/db/conn.js'
import { roundCents } from '../shared/money.js'
import { ObjectId } from 'mongodb'

const orders = db.collection<Order>('orders')
const orderItems = db.collection<OrderItem>('orderItems')
const products = db.collection<Product>('products')

export class InsufficientStockError extends Error {
  constructor(public productId: ObjectId) {
    super('Stock insuficiente')
  }
}

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

  // crea el pedido y sus ítems en una transacción: se guarda todo o nada
  public async addWithItems(order: Order, items: Omit<OrderItem, 'orderId'>[]): Promise<{ order: Order; items: OrderItem[] }> {
    // withSession cierra la sesión solo; withTransaction reintenta ante errores transitorios
    return await cli.withSession((session) =>
      session.withTransaction(async () => {
        order._id = (await orders.insertOne(order, { session })).insertedId
        const savedItems = items.map((item) => ({ ...item, orderId: order._id! }))
        await orderItems.insertMany(savedItems, { session })
        return { order, items: savedItems }
      })
    )
  }

  public async findItems(orderId: ObjectId): Promise<OrderItem[]> {
    return await orderItems.find({ orderId }).toArray()
  }

  // cambia el estado solo si el pedido sigue en "from": si dos pedidos llegan juntos, gana uno solo.
  // Al pagar se descuenta el stock de cada ítem en la misma transacción; si uno no alcanza se revierte todo
  public async changeStatus(orderId: ObjectId, from: OrderStatus, to: OrderStatus): Promise<Order | null> {
    if (to !== 'pagado') {
      return await orders.findOneAndUpdate({ _id: orderId, status: from }, { $set: { status: to } }, { returnDocument: 'after' })
    }
    return await cli.withSession((session) =>
      session.withTransaction(async () => {
        const order = await orders.findOneAndUpdate({ _id: orderId, status: from }, { $set: { status: to } }, { session, returnDocument: 'after' })
        if (!order) return null
        for (const item of await orderItems.find({ orderId }, { session }).toArray()) {
          const { modifiedCount } = await products.updateOne(
            { _id: item.productId, stock: { $gte: item.quantity } },
            { $inc: { stock: -item.quantity } },
            { session }
          )
          if (modifiedCount === 0) throw new InsufficientStockError(item.productId)
          // si la venta lo dejó en cero, el producto pasa a "sin stock"
          await products.updateOne({ _id: item.productId, stock: 0 }, { $set: { status: OUT_OF_STOCK } }, { session })
        }
        return order
      })
    )
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
    await orders.updateOne({ _id: orderId }, { $set: { total: roundCents(result?.total ?? 0) } })
  }
}
