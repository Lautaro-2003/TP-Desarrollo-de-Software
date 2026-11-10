// Datos de demostración para la presentación: se corren después de seed.ts con "npm run seed".
// Las pruebas usan solo seed.ts, así que estos datos no las afectan. Todo es idempotente (ids fijos + upsert).
import { ObjectId } from "mongodb"
import { db } from "./conn.js"
import { hashPassword } from "../../auth/auth.js"
import { ReviewRepository } from "../../review/review.Repository.js"
import { slugify } from "../slug.js"
import { unsplash } from "./unsplash.js"

const id = (n: number) => new ObjectId(`675000000000000000000${String(n).padStart(3, "0")}`)
const upsert = (collection: string, _id: ObjectId, doc: object) =>
  db.collection(collection).updateOne({ _id }, { $setOnInsert: doc }, { upsert: true })

// ids del seed base
const PLACAS = new ObjectId("674a1b2c3d4e5f6789012345")
const PERIFERICOS = new ObjectId("674a1b2c3d4e5f6789012347")
const TECLADO = new ObjectId("674a1b2c3d4e5f678901234c")

const ALMACENAMIENTO = id(1)
const MONITORES = id(2)
await upsert("categories", ALMACENAMIENTO, { name: "Almacenamiento", description: "Discos SSD y HDD" })
await upsert("categories", MONITORES, { name: "Monitores", description: "Pantallas para gaming y oficina" })

const RX = id(101)
const MOUSE = id(102)
const AURICULARES = id(103)
const SSD = id(104)
const HDD = id(105)
const MONITOR = id(106)
// el alta respeta lo que ya haya en la base; slug y foto se actualizan siempre (una base ya cargada también los recibe)
const product = async (_id: ObjectId, name: string, description: string, price: number, stock: number, categoryId: ObjectId, photo: string) => {
  await upsert("products", _id, { name, description, price, stock, status: "disponible", categoryId })
  await db.collection("products").updateOne({ _id }, { $set: { slug: slugify(name), image: unsplash(photo) } })
}
await product(RX, "RX 7800 XT", "Placa de video de 16 GB para jugar en 1440p", 650, 4, PLACAS, "1651873811841-bf59e1a972db")
await product(MOUSE, "Mouse inalámbrico", "Mouse ergonómico con sensor de 16000 DPI", 45, 25, PERIFERICOS, "1527864550417-7fd91fc51a46")
await product(AURICULARES, "Auriculares gamer", "Auriculares con micrófono y sonido envolvente", 90, 12, PERIFERICOS, "1583394838336-acd977736f90")
await product(SSD, "SSD NVMe 1 TB", "Disco de estado sólido PCIe 4.0", 85, 30, ALMACENAMIENTO, "1677086586945-ef95ab632232")
await product(HDD, "Disco HDD 2 TB", "Disco rígido de 7200 RPM", 60, 15, ALMACENAMIENTO, "1601737487795-dab272f52420")
await product(MONITOR, 'Monitor 27" 144 Hz', "Monitor IPS QHD de 27 pulgadas", 320, 6, MONITORES, "1666771410003-8437c4781d49")

// descuento vigente durante la presentación: Almacenamiento al 15%
await upsert("discounts", id(201), {
  categoryId: ALMACENAMIENTO,
  percentage: 15,
  startDate: new Date("2026-11-01"),
  endDate: new Date("2027-12-31"),
})

const MARIA = id(301)
const LUCIA = id(302)
const cliente = async (name: string, email: string, address: string) => ({
  name,
  email,
  address,
  role: "cliente",
  passwordHash: await hashPassword("cliente1234"),
})
await upsert("users", MARIA, await cliente("María Gómez", "maria.gomez@mail.com", "Córdoba 1500, Rosario"))
await upsert("users", LUCIA, await cliente("Lucía Fernández", "lucia.fernandez@mail.com", "Mitre 820, Rosario"))

// pedidos ya pagados en distintos estados; el precio unitario quedó congelado al comprar
type Line = [productId: ObjectId, quantity: number, unitPrice: number]
let itemId = 500
async function order(_id: ObjectId, userId: ObjectId, date: string, status: string, lines: Line[]) {
  const items = lines.map(([productId, quantity, unitPrice]) => ({ productId, quantity, unitPrice, subtotal: Math.round(quantity * unitPrice * 100) / 100 }))
  const total = Math.round(items.reduce((sum, i) => sum + i.subtotal, 0) * 100) / 100
  await upsert("orders", _id, { userId, date: new Date(date), status, total })
  for (const item of items) await upsert("orderItems", id(itemId++), { ...item, orderId: _id })
}
await order(id(401), MARIA, "2026-10-05T15:00:00Z", "entregado", [[SSD, 2, 85], [MOUSE, 1, 45]])
await order(id(402), LUCIA, "2026-10-12T18:30:00Z", "entregado", [[MONITOR, 1, 320], [TECLADO, 1, 120]])
await order(id(403), MARIA, "2026-11-03T12:10:00Z", "pagado", [[RX, 1, 650], [AURICULARES, 1, 90]])
await order(id(404), LUCIA, "2026-11-04T20:45:00Z", "enviado", [[SSD, 1, 72.25], [HDD, 1, 51]]) // con el 15% de descuento

// reseñas solo de productos que cada clienta compró (misma regla que la API)
type ReviewSeed = [n: number, userId: ObjectId, productId: ObjectId, rating: number, comment: string, date: string]
const reviews: ReviewSeed[] = [
  [601, MARIA, SSD, 5, "Rapidísimo, lo instalé en diez minutos y la PC arranca al toque.", "2026-10-10"],
  [602, MARIA, MOUSE, 4, "Cómodo y la batería dura bastante. La rueda es un poco dura.", "2026-10-11"],
  [603, MARIA, RX, 5, "Corre todo en 1440p sin problemas.", "2026-11-05"],
  [604, LUCIA, MONITOR, 5, "Colores muy buenos y los 144 Hz se notan.", "2026-10-20"],
  [605, LUCIA, TECLADO, 4, "Muy buen teclado, un poco ruidoso para la oficina.", "2026-10-21"],
  [606, LUCIA, SSD, 4, "Buena velocidad por el precio.", "2026-11-05"],
]
for (const [n, userId, productId, rating, comment, date] of reviews) {
  await upsert("reviews", id(n), { userId, productId, rating, comment, date: new Date(date) })
}

// el promedio de cada producto se calcula igual que en la API
const repository = new ReviewRepository()
for (const productId of new Set(reviews.map((r) => r[2]))) await repository.recalculateProductRating(productId)

process.exit(0)
