import { Db, MongoClient, ServerApiVersion } from "mongodb"
import dns from "node:dns"

// opcional: servidores DNS a usar (ej. "8.8.8.8,1.1.1.1"). Sirve cuando el DNS
// de la red no resuelve los registros SRV que necesita una URI mongodb+srv://
const dnsServers = process.env.DNS_SERVERS
if (dnsServers) {
  dns.setServers(dnsServers.split(",").map((s) => s.trim()))
}

const uri = process.env.MONGODB_URI
if (!uri) {
  throw new Error("MONGODB_URI es obligatorio")
}

const dbName = process.env.MONGODB_DB || "tienda"

// se exporta el cliente para poder abrir transacciones (ej. checkout)
export const cli = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
})

await cli.connect()

export const db: Db = cli.db(dbName)

await db.command({ ping: 1 })
