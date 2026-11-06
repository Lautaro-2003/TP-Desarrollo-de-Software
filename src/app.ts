import express from 'express'
import { categoryRouter } from './category/category.routes.js'
import { productRouter } from './product/product.routes.js'
import { orderItemRouter } from './orderItem/orderItem.routes.js'
import { userRouter } from './user/user.routes.js'
import { orderRouter } from './order/order.routes.js'

const app = express()
app.use(express.json())
// en Express 5 req.body queda undefined si el pedido no trae JSON; los controladores esperan un objeto
app.use((req, _res, next) => {
  req.body ??= {}
  next()
})

app.use('/api/categories', categoryRouter)
app.use('/api/products', productRouter)
app.use('/api/order-items', orderItemRouter)
app.use('/api/users', userRouter)
app.use('/api/orders', orderRouter)


app.use((_, res) => {
   return res.status(404).send({ message: "Recurso no encontrado" })
}) // manda un mensaje cuando la url no existe

app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  // express.json marca el JSON mal formado con type "entity.parse.failed": es un error del cliente
  if ((err as { type?: string } | null)?.type === "entity.parse.failed") {
    return res.status(400).send({ message: "El cuerpo del pedido no es un JSON válido" })
  }
  console.error(err)
  res.status(500).send({ message: "Error interno del servidor" })
})

app.listen(3000, () => {
  console.log("Servidor escuchando en http://localhost:3000/")
})