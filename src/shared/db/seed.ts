import { ObjectId } from "mongodb"
import { db } from "./conn.js"

await db.collection("categories").updateOne(
  { _id: new ObjectId("674a1b2c3d4e5f6789012345") },
  {
    $setOnInsert: {
      name: "Placas de Video",
      description: "Tarjetas gráficas para gaming, diseño y renderizado",
    },
  },
  { upsert: true }
)

await db.collection("categories").updateOne(
  { _id: new ObjectId("674a1b2c3d4e5f6789012347") },
  {
    $setOnInsert: {
      name: "Periféricos",
      description: "Teclados, mouses y auriculares",
    },
  },
  { upsert: true }
)

await db.collection("orders").updateOne(
  { _id: new ObjectId("674a1b2c3d4e5f6789012346") },
  { $setOnInsert: {} },
  { upsert: true }
)

await db.collection("products").updateOne(
  { _id: new ObjectId("674a1b2c3d4e5f6789012349") },
  {
    $setOnInsert: {
      name: "RTX 4070",
      description: "Placa de video para gaming",
      price: 800,
      stock: 5,
      status: "disponible",
      categoryId: new ObjectId("674a1b2c3d4e5f6789012345"),
    },
  },
  { upsert: true }
)

process.exit(0)
