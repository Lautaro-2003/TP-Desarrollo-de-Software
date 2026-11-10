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
const RTX = new ObjectId("674a1b2c3d4e5f6789012349")
const TECLADO = new ObjectId("674a1b2c3d4e5f678901234c")

const ALMACENAMIENTO = id(1)
const MONITORES = id(2)
const PROCESADORES = id(3)
const MEMORIAS = id(4)
await upsert("categories", ALMACENAMIENTO, { name: "Almacenamiento", description: "Discos SSD y HDD" })
await upsert("categories", MONITORES, { name: "Monitores", description: "Pantallas para gaming y oficina" })
await upsert("categories", PROCESADORES, { name: "Procesadores", description: "CPUs AMD Ryzen e Intel Core" })
await upsert("categories", MEMORIAS, { name: "Memorias RAM", description: "Módulos DDR4 y DDR5 para PC de escritorio" })

const RX = id(101)
const MOUSE = id(102)
const AURICULARES = id(103)
const SSD = id(104)
const HDD = id(105)
const MONITOR = id(106)
const RTX_4060_TI = id(107)
const RTX_4090 = id(108)
const MOUSEPAD = id(109)
const WEBCAM = id(110)
const SSD_2TB = id(111)
const DISCO_EXTERNO = id(112)
const MONITOR_24 = id(113)
const MONITOR_4K = id(114)
const MONITOR_CURVO = id(115)
const CORE_I3 = id(116)
const CORE_I5 = id(117)
const CORE_I9 = id(118)
const RYZEN_7 = id(119)
const DDR5_32 = id(120)
const DDR5_16 = id(121)
const DDR4_16 = id(122)
const DDR4_8 = id(123)
// precio y categoría de cada producto, para congelar el precio de los pedidos con el descuento de su fecha
// (los dos del seed base, con los mismos valores que seed.ts)
const catalog = new Map<string, { price: number; categoryId: ObjectId }>([
  [RTX.toString(), { price: 800, categoryId: PLACAS }],
  [TECLADO.toString(), { price: 120, categoryId: PERIFERICOS }],
])
// el alta respeta lo que ya haya en la base; slug y foto se actualizan siempre (una base ya cargada también los recibe).
// Sin foto la tienda muestra la huella: Unsplash no tiene un Ryzen sobre fondo claro
const product = async (_id: ObjectId, name: string, description: string, price: number, stock: number, categoryId: ObjectId, photo?: string) => {
  catalog.set(_id.toString(), { price, categoryId })
  await upsert("products", _id, { name, description, price, stock, status: stock > 0 ? "disponible" : "sin stock", categoryId })
  await db.collection("products").updateOne({ _id }, { $set: { slug: slugify(name), ...(photo ? { image: unsplash(photo) } : {}) } })
}
await product(RX, "RX 7800 XT", "Placa de video de 16 GB para jugar en 1440p", 650, 4, PLACAS, "1651873811841-bf59e1a972db")
await product(MOUSE, "Mouse inalámbrico", "Mouse ergonómico con sensor de 16000 DPI", 45, 25, PERIFERICOS, "1527864550417-7fd91fc51a46")
await product(AURICULARES, "Auriculares gamer", "Auriculares con micrófono y sonido envolvente", 90, 12, PERIFERICOS, "1583394838336-acd977736f90")
await product(SSD, "SSD NVMe 1 TB", "Disco de estado sólido PCIe 4.0", 85, 30, ALMACENAMIENTO, "1677086586945-ef95ab632232")
await product(HDD, "Disco HDD 2 TB", "Disco rígido de 7200 RPM", 60, 15, ALMACENAMIENTO, "1601737487795-dab272f52420")
await product(MONITOR, 'Monitor 27" 144 Hz', "Monitor IPS QHD de 27 pulgadas", 320, 6, MONITORES, "1666771410003-8437c4781d49")
// cada foto muestra el mismo modelo o uno sin marca a la vista (la caja de la 4090 dice 4090, el chip del i9 dice i9)
await product(RTX_4060_TI, "RTX 4060 Ti 8 GB", "Placa de video para jugar en 1080p con DLSS 3", 450, 7, PLACAS, "1624701928517-44c8ac49d93c")
await product(RTX_4090, "RTX 4090 24 GB", "La placa de video más potente para 4K y renderizado", 2100, 2, PLACAS, "1732775490298-995203fae959")
await product(MOUSEPAD, "Mousepad de fieltro", "Mousepad de 30 x 25 cm con base antideslizante", 25, 40, PERIFERICOS, "1700451960095-c37c0b388624")
await product(WEBCAM, "Webcam Full HD", "Cámara web 1080p a 60 fps con micrófono integrado", 70, 0, PERIFERICOS, "1623949556303-b0d17d198863")
await product(SSD_2TB, "SSD NVMe 2 TB", "Disco de estado sólido PCIe 4.0 de hasta 7000 MB/s", 150, 9, ALMACENAMIENTO, "1669480380758-4b163a33f6f9")
await product(DISCO_EXTERNO, "Disco externo 1 TB", "Disco portátil USB 3.0 para respaldos", 55, 18, ALMACENAMIENTO, "1624895608078-e9f564cbe3fa")
await product(MONITOR_24, 'Monitor 24" 165 Hz', "Monitor IPS Full HD para gaming competitivo", 210, 10, MONITORES, "1587831990711-23ca6441447b")
await product(MONITOR_4K, 'Monitor 32" 4K', "Monitor IPS UHD para diseño y edición de video", 480, 3, MONITORES, "1570485071395-29b575ea3b4e")
await product(MONITOR_CURVO, 'Monitor curvo 34" ultrawide', "Monitor curvo WQHD 21:9 de 144 Hz", 560, 4, MONITORES, "1666771410333-3457e9603dd4")
await product(CORE_I3, "Core i3-14100F", "Procesador de 4 núcleos para oficina y gaming de entrada", 110, 14, PROCESADORES, "1676315487591-7a1d5c02ecae")
await product(CORE_I5, "Core i5-14400F", "Procesador de 10 núcleos para gaming", 200, 11, PROCESADORES, "1673470609632-394851a7c77e")
await product(CORE_I9, "Core i9-14900K", "Procesador de 24 núcleos para gaming y creación de contenido", 580, 3, PROCESADORES, "1555616635-640b71bdb185")
await product(RYZEN_7, "Ryzen 7 7800X3D", "Procesador de 8 núcleos con 3D V-Cache para gaming", 450, 5, PROCESADORES)
await product(DDR5_32, "Memoria DDR5 32 GB (2×16) 6000 MHz", "Kit de dos módulos con disipador para plataformas DDR5", 120, 15, MEMORIAS, "1699796990049-3406a9991baa")
await product(DDR5_16, "Memoria DDR5 16 GB (2×8) 5600 MHz", "Kit de dos módulos para plataformas DDR5", 70, 20, MEMORIAS, "1699796990062-c7a064563fc2")
await product(DDR4_16, "Memoria DDR4 16 GB (2×8) 3200 MHz", "Kit de dos módulos para plataformas DDR4", 45, 25, MEMORIAS, "1676554565685-3aeb5d7ad1b7")
await product(DDR4_8, "Memoria DDR4 8 GB 3200 MHz", "Módulo para ampliar una PC de oficina", 22, 2, MEMORIAS, "1654240253461-3f51c793b366")

// tres vigentes durante la presentación, uno vencido (los pedidos de septiembre lo congelaron) y uno programado para el Hot Sale.
// Los que ya había en la base no se tocan; las fechas no pisan pedidos anteriores del demo (Periféricos arranca después del pedido 403)
type DiscountSeed = [n: number, categoryId: ObjectId, percentage: number, startDate: string, endDate: string]
const discounts: DiscountSeed[] = [
  [201, ALMACENAMIENTO, 15, "2026-11-01", "2027-12-31"],
  [202, PERIFERICOS, 10, "2026-11-08", "2027-12-31"],
  [203, PROCESADORES, 20, "2026-11-08", "2027-12-31"],
  [204, MONITORES, 25, "2026-09-01", "2026-10-01"],
  [205, MEMORIAS, 30, "2027-05-10", "2027-05-17"],
]
for (const [n, categoryId, percentage, startDate, endDate] of discounts) {
  await upsert("discounts", id(n), { categoryId, percentage, startDate: new Date(startDate), endDate: new Date(endDate) })
}

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
