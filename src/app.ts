import express from 'express'
import { categoryRouter } from './category/category.routes.js'

const app = express()
app.use(express.json())


app.use('/api/categories', categoryRouter)


app.use((_, res) => {
   return res.status(404).send({ message: "Resource not found" })
}) // manda un mensaje cuando la url no existe

app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(err)
  res.status(500).send({ message: "Internal server error" })
})

app.listen(3000, () => {
  console.log("Server running on http://localhost:3000/")
})