import express from 'express'
import { categoryRouter } from './category/category.routes.js'
import { productRouter } from './product/product.routes.js'
import { orderItemRouter } from './orderItem/orderItem.routes.js'

const app = express()
app.use(express.json())


app.use('/api/categories', categoryRouter)
app.use('/api/products', productRouter)
app.use('/api/order-items', orderItemRouter)


app.use((_, res) => {
   return res.status(404).send({ message: "Recurso no encontrado" })
}) // manda un mensaje cuando la url no existe

app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(err)
  res.status(500).send({ message: "Error interno del servidor" })
})

app.listen(3000, () => {
  console.log("Servidor escuchando en http://localhost:3000/")
})