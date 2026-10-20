import { Db, MongoClient, ServerApiVersion } from "mongodb"

const uri = process.env.MONGODB_URI
if (!uri) {
  throw new Error("MONGODB_URI es obligatorio")
}

const dbName = process.env.MONGODB_DB || "tienda"

const cli = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
})

await cli.connect()

export const db: Db = cli.db(dbName)

await db.command({ ping: 1 })
