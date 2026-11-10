// Pruebas de integración de la API: levantan el servidor real contra una base de prueba en MongoDB
// Correr con: npm test (usa MONGODB_URI del .env y la base "tienda_test", que se borra en cada corrida)
import { test, before, after, describe } from "node:test"
import assert from "node:assert/strict"
import { spawn, spawnSync, ChildProcess } from "node:child_process"

const TEST_DB = "tienda_test"
const PORT = "3999"
const BASE = `http://localhost:${PORT}/api`
const env = { ...process.env, MONGODB_DB: TEST_DB, PORT }

// ids fijos del seed
const PLACAS = "674a1b2c3d4e5f6789012345"
const PERIFERICOS = "674a1b2c3d4e5f6789012347"
const RTX = "674a1b2c3d4e5f6789012349" // precio 800, stock 5
const TECLADO = "674a1b2c3d4e5f678901234c" // precio 120, stock 10
const JUAN = "674a1b2c3d4e5f678901234b"
const NO_EXISTE = "674a1b2c3d4e5f6789012399"

let server: ChildProcess
// sesiones de los usuarios del seed (se cargan en before)
let adminToken = ""
let juanToken = ""

// por defecto llama como admin; token: null llama sin sesión
async function api(method: string, path: string, body?: unknown, opts: { raw?: string; token?: string | null } = {}) {
  const token = opts.token === undefined ? adminToken : opts.token
  const headers: Record<string, string> = {}
  if (body !== undefined || opts.raw !== undefined) headers["Content-Type"] = "application/json"
  if (token) headers.Authorization = `Bearer ${token}`
  const res = await fetch(BASE + path, {
    method,
    headers,
    body: opts.raw ?? (body !== undefined ? JSON.stringify(body) : undefined),
  })
  return { status: res.status, body: (await res.json()) as any }
}

async function login(email: string, password: string) {
  return (await api("POST", "/auth/login", { email, password }, { token: null })).body.data.token as string
}

// hace lo mismo que abrir el link del mail: lee el token de la base y llama al endpoint de confirmación
async function confirmEmail(email: string) {
  const { db } = await import("../shared/db/conn.js")
  const user = await db.collection("users").findOne({ email })
  return api("GET", `/auth/confirm/${user!.emailToken}`, undefined, { token: null })
}

before(async () => {
  // seguridad: nunca borrar una base que no sea de prueba
  process.env.MONGODB_DB = TEST_DB
  const { db } = await import("../shared/db/conn.js")
  assert.ok(db.databaseName.endsWith("_test"), "las pruebas solo corren sobre una base *_test")
  await db.dropDatabase()

  const seed = spawnSync(process.execPath, ["dist/shared/db/seed.js"], { env, encoding: "utf8" })
  assert.equal(seed.status, 0, seed.stderr)

  server = spawn(process.execPath, ["dist/app.js"], { env, stdio: "inherit" })
  let up = false
  for (let i = 0; i < 60 && !up; i++) {
    up = await fetch(BASE + "/categories").then(() => true, () => false)
    if (!up) await new Promise((r) => setTimeout(r, 500))
  }
  assert.ok(up, "El servidor de prueba no arrancó")

  // credenciales de prueba del seed
  adminToken = await login("admin@tienda.com", "admin1234")
  juanToken = await login("juan.perez@mail.com", "cliente1234")
})

after(async () => {
  server?.kill()
  const { cli } = await import("../shared/db/conn.js")
  await cli.close()
})

describe("generales", () => {
  test("ruta inexistente → 404", async () => {
    assert.equal((await api("GET", "/nada")).status, 404)
  })
  test("POST sin cuerpo → 400 (no 500)", async () => {
    assert.equal((await api("POST", "/categories")).status, 400)
    assert.equal((await api("POST", "/users")).status, 400)
    assert.equal((await api("POST", "/orders/checkout")).status, 400)
  })
  test("JSON mal formado → 400", async () => {
    const res = await api("POST", "/categories", undefined, { raw: "{ nombre: " })
    assert.equal(res.status, 400)
  })
})

describe("categorías", () => {
  test("crear, validar y modificar", async () => {
    const created = await api("POST", "/categories", { name: "  Almacenamiento ", description: "SSD y HDD" })
    assert.equal(created.status, 201)
    assert.equal(created.body.data.name, "Almacenamiento")
    assert.equal(created.body.data.slug, "almacenamiento")
    assert.equal((await api("POST", "/categories", { name: "almacenamiento", description: "repetida" })).status, 409)
    assert.equal((await api("PATCH", `/categories/${PLACAS}`, { name: "Almacenamiento" })).status, 409)
    assert.equal((await api("POST", "/categories", { description: "sin nombre" })).status, 400)
    assert.equal((await api("POST", "/categories", { name: "", description: "x" })).status, 400)

    const id = created.body.data._id
    assert.equal((await api("PATCH", `/categories/${id}`, {})).status, 400)
    assert.equal((await api("PATCH", `/categories/${id}`, { name: 5 })).status, 400)
    const patched = await api("PATCH", `/categories/${id}`, { description: "Discos" })
    assert.equal(patched.body.data.description, "Discos")
    assert.equal(patched.body.data.name, "Almacenamiento")
    // renombrar cambia el slug
    assert.equal((await api("PATCH", `/categories/${id}`, { name: "Discos Rígidos" })).body.data.slug, "discos-rigidos")
    assert.equal((await api("DELETE", `/categories/${id}`)).status, 200)
  })
  test("ids inválidos e inexistentes", async () => {
    assert.equal((await api("GET", "/categories/xx")).status, 400)
    assert.equal((await api("PATCH", "/categories/xx", { name: "a" })).status, 400)
    assert.equal((await api("DELETE", "/categories/xx")).status, 400)
    assert.equal((await api("GET", `/categories/${NO_EXISTE}`)).status, 404)
    assert.equal((await api("PATCH", `/categories/${NO_EXISTE}`, { name: "a" })).status, 404)
  })
  test("no se borra una categoría con productos", async () => {
    assert.equal((await api("DELETE", `/categories/${PLACAS}`)).status, 409)
  })
})

describe("productos", () => {
  test("validaciones de alta", async () => {
    const base = { name: "Mouse", description: "Mouse gamer", price: 50, stock: 3, status: "disponible", categoryId: PERIFERICOS }
    assert.equal((await api("POST", "/products", { ...base, price: 0 })).status, 400)
    assert.equal((await api("POST", "/products", { ...base, stock: -1 })).status, 400)
    assert.equal((await api("POST", "/products", { ...base, stock: 1.5 })).status, 400)
    assert.equal((await api("POST", "/products", { ...base, categoryId: NO_EXISTE })).status, 404)
    const created = await api("POST", "/products", base)
    assert.equal(created.status, 201)
    assert.equal((await api("DELETE", `/products/${created.body.data._id}`)).status, 200)
  })
  test("slug legible para la URL, único, y foto opcional", async () => {
    const base = { name: "Placa Ñandú 3060 Ti", description: "Placa", price: 300, stock: 2, status: "disponible", categoryId: PLACAS }
    assert.equal((await api("POST", "/products", { ...base, image: "ftp://x.com/a.jpg" })).status, 400)
    const created = await api("POST", "/products", { ...base, image: " https://example.com/placa.jpg " })
    assert.equal(created.status, 201)
    assert.equal(created.body.data.slug, "placa-nandu-3060-ti")
    assert.equal(created.body.data.image, "https://example.com/placa.jpg")
    // se encuentra por slug y por id; el seed también trae slug
    assert.equal((await api("GET", "/products/placa-nandu-3060-ti", undefined, { token: null })).body.data._id, created.body.data._id)
    assert.equal((await api("GET", "/products/rtx-4070", undefined, { token: null })).body.data._id, RTX)
    assert.equal((await api("GET", "/products/no-existe", undefined, { token: null })).status, 404)
    // dos productos no pueden compartir URL, ni al crear ni al renombrar
    assert.equal((await api("POST", "/products", { ...base, name: "placa ñandu 3060-TI" })).status, 409)
    assert.equal((await api("PATCH", `/products/${created.body.data._id}`, { name: "RTX 4070" })).status, 409)
    const renamed = await api("PATCH", `/products/${created.body.data._id}`, { name: "Placa Ñandú 3060", image: "" })
    assert.equal(renamed.body.data.slug, "placa-nandu-3060")
    assert.equal(renamed.body.data.image, "")
    assert.equal((await api("DELETE", `/products/${created.body.data._id}`)).status, 200)
  })
  test("con stock 0 el estado pasa solo a «sin stock»", async () => {
    const base = { name: "Pad Mouse", description: "Pad", price: 10, stock: 0, status: "disponible", categoryId: PERIFERICOS }
    const created = await api("POST", "/products", base)
    assert.equal(created.body.data.status, "sin stock")
    const id = created.body.data._id
    // al reponer se respeta el estado enviado; al volver a cero se fuerza, aunque solo cambie el estado
    assert.equal((await api("PATCH", `/products/${id}`, { stock: 4, status: "disponible" })).body.data.status, "disponible")
    assert.equal((await api("PATCH", `/products/${id}`, { stock: 0 })).body.data.status, "sin stock")
    assert.equal((await api("PATCH", `/products/${id}`, { status: "disponible" })).body.data.status, "sin stock")
    assert.equal((await api("DELETE", `/products/${id}`)).status, 200)
  })
  test("filtro por categoría", async () => {
    const res = await api("GET", `/products?categoryId=${PLACAS}`)
    assert.deepEqual(res.body.data.map((p: any) => p._id), [RTX])
    assert.equal((await api("GET", "/products?categoryId=xx")).status, 400)
  })
})

describe("usuarios", () => {
  test("alta con email normalizado y rol cliente por defecto", async () => {
    const res = await api("POST", "/users", { name: "Ana", email: " Ana@Mail.COM ", address: "Calle 1", password: "secreta123" })
    assert.equal(res.status, 201)
    assert.equal(res.body.data.email, "ana@mail.com")
    assert.equal(res.body.data.role, "cliente")
    // el mismo email con otras mayúsculas también es repetido
    assert.equal((await api("POST", "/users", { name: "Ana 2", email: "ANA@mail.com", address: "x", password: "secreta123" })).status, 409)
    assert.equal((await api("DELETE", `/users/${res.body.data._id}`)).status, 200)
  })
  test("validaciones", async () => {
    assert.equal((await api("POST", "/users", { name: "a", email: "no-es-email", address: "x", password: "secreta123" })).status, 400)
    assert.equal((await api("POST", "/users", { name: "a", email: "a@b.co", address: "x", role: "root", password: "secreta123" })).status, 400)
    assert.equal((await api("POST", "/users", { email: "a@b.co", address: "x", password: "secreta123" })).status, 400)
    assert.equal((await api("PATCH", `/users/${JUAN}`, { email: "admin@tienda.com" })).status, 409)
  })
  test("no se borra un usuario con pedidos", async () => {
    assert.equal((await api("DELETE", `/users/${JUAN}`)).status, 409)
  })
})

describe("pedidos e ítems", () => {
  test("el pedido nace pendiente con total 0 e ignora status y total del cliente", async () => {
    const res = await api("POST", "/orders", { userId: JUAN, status: "entregado", total: 999 })
    assert.equal(res.status, 201)
    assert.equal(res.body.data.status, "pendiente")
    assert.equal(res.body.data.total, 0)
    assert.equal((await api("POST", "/orders", { userId: NO_EXISTE })).status, 404)
    assert.equal((await api("POST", "/orders", { userId: "xx" })).status, 400)
    await api("DELETE", `/orders/${res.body.data._id}`)
  })

  test("el total se recalcula al agregar, modificar, mover y quitar ítems", async () => {
    const a = (await api("POST", "/orders", { userId: JUAN })).body.data._id
    const b = (await api("POST", "/orders", { userId: JUAN })).body.data._id
    const total = async (id: string) => (await api("GET", `/orders/${id}`)).body.data.total

    // el precio lo pone el servidor aunque el cliente mande otro
    const item = await api("POST", "/order-items", { orderId: a, productId: RTX, quantity: 2, unitPrice: 1 })
    assert.equal(item.body.data.unitPrice, 800)
    await api("POST", "/order-items", { orderId: a, productId: TECLADO, quantity: 1 })
    assert.equal(await total(a), 1720)

    await api("PATCH", `/order-items/${item.body.data._id}`, { quantity: 1 })
    assert.equal(await total(a), 920)

    await api("PATCH", `/order-items/${item.body.data._id}`, { orderId: b })
    assert.equal(await total(a), 120)
    assert.equal(await total(b), 800)

    await api("DELETE", `/order-items/${item.body.data._id}`)
    assert.equal(await total(b), 0)

    // dar de baja un pedido pendiente borra también sus ítems
    assert.equal((await api("DELETE", `/orders/${a}`)).status, 200)
    const items = (await api("GET", "/order-items")).body.data
    assert.equal(items.filter((i: any) => i.orderId === a).length, 0)
    await api("DELETE", `/orders/${b}`)
  })

  test("un pedido no pendiente no se puede tocar", async () => {
    // usa el teclado para no consumir stock de la RTX que verifican otras pruebas
    const id = (await api("POST", "/orders", { userId: JUAN })).body.data._id
    const item = (await api("POST", "/order-items", { orderId: id, productId: TECLADO, quantity: 1 })).body.data
    assert.equal((await api("PATCH", `/orders/${id}/status`, { status: "pagado" })).status, 200)

    assert.equal((await api("POST", "/order-items", { orderId: id, productId: TECLADO, quantity: 1 })).status, 409)
    assert.equal((await api("PATCH", `/order-items/${item._id}`, { quantity: 2 })).status, 409)
    assert.equal((await api("DELETE", `/order-items/${item._id}`)).status, 409)
    assert.equal((await api("PATCH", `/orders/${id}`, { userId: JUAN })).status, 409)
    assert.equal((await api("DELETE", `/orders/${id}`)).status, 409)
    // un producto con ítems de pedido no se puede borrar
    assert.equal((await api("DELETE", `/products/${TECLADO}`)).status, 409)
  })

  test("el estado no se cambia por el PATCH genérico", async () => {
    const id = (await api("POST", "/orders", { userId: JUAN })).body.data._id
    assert.equal((await api("PATCH", `/orders/${id}`, { status: "pagado" })).status, 400)
    await api("DELETE", `/orders/${id}`)
  })

  test("filtro de pedidos por usuario", async () => {
    const res = await api("GET", `/orders?userId=${JUAN}`)
    assert.ok(res.body.data.every((o: any) => o.userId === JUAN))
    assert.equal((await api("GET", "/orders?userId=xx")).status, 400)
  })
})

describe("checkout (Epic 1)", () => {
  test("crea el pedido con sus ítems, juntando productos repetidos", async () => {
    const res = await api("POST", "/orders/checkout", {
      userId: JUAN,
      items: [
        { productId: RTX, quantity: 2 },
        { productId: TECLADO, quantity: 1 },
        { productId: TECLADO, quantity: 2 },
      ],
    })
    assert.equal(res.status, 201)
    assert.equal(res.body.data.order.status, "pendiente")
    assert.equal(res.body.data.order.total, 800 * 2 + 120 * 3)
    assert.equal(res.body.data.items.length, 2)

    // los ítems quedaron guardados en la base, apuntando al pedido
    const id = res.body.data.order._id
    const items = (await api("GET", "/order-items")).body.data.filter((i: any) => i.orderId === id)
    assert.equal(items.length, 2)
    // el checkout no descuenta stock (se descuenta al pagar)
    assert.equal((await api("GET", `/products/${RTX}`)).body.data.stock, 5)
    await api("DELETE", `/orders/${id}`)
  })

  test("stock insuficiente → 409 con el detalle, sumando repetidos", async () => {
    const res = await api("POST", "/orders/checkout", {
      userId: JUAN,
      items: [{ productId: RTX, quantity: 4 }, { productId: RTX, quantity: 2 }],
    })
    assert.equal(res.status, 409)
    assert.deepEqual(res.body.data, [{ productId: RTX, name: "RTX 4070", stock: 5, requested: 6 }])
  })

  test("carritos inválidos", async () => {
    const casos: [unknown, number][] = [
      [{ userId: JUAN, items: [] }, 400],
      [{ userId: JUAN }, 400],
      [{ userId: JUAN, items: "x" }, 400],
      [{ userId: "xx", items: [{ productId: RTX, quantity: 1 }] }, 400],
      [{ userId: JUAN, items: [null] }, 400],
      [{ userId: JUAN, items: [{ productId: "xx", quantity: 1 }] }, 400],
      [{ userId: JUAN, items: [{ productId: RTX, quantity: 0 }] }, 400],
      [{ userId: JUAN, items: [{ productId: RTX, quantity: 1.5 }] }, 400],
      [{ userId: JUAN, items: [{ productId: RTX, quantity: "2" }] }, 400],
      [{ userId: NO_EXISTE, items: [{ productId: RTX, quantity: 1 }] }, 404],
      [{ userId: JUAN, items: [{ productId: NO_EXISTE, quantity: 1 }] }, 404],
    ]
    for (const [body, status] of casos) {
      assert.equal((await api("POST", "/orders/checkout", body)).status, status, JSON.stringify(body))
    }
  })
})

// va al final: consume stock de la RTX
describe("estados del pedido (Epic 2)", () => {
  const stock = async (id: string) => (await api("GET", `/products/${id}`)).body.data.stock
  const status = (id: string, s: unknown) => api("PATCH", `/orders/${id}/status`, { status: s })

  test("ciclo completo pendiente → pagado → enviado → entregado, descontando stock al pagar", async () => {
    const [rtx, teclado] = [await stock(RTX), await stock(TECLADO)]
    const checkout = await api("POST", "/orders/checkout", {
      userId: JUAN,
      items: [{ productId: RTX, quantity: 2 }, { productId: TECLADO, quantity: 1 }],
    })
    const id = checkout.body.data.order._id

    // detalle del pedido con sus ítems
    const detail = (await api("GET", `/orders/${id}`)).body.data
    assert.equal(detail.items.length, 2)
    assert.equal(detail.total, 1720)

    assert.equal((await status(id, "enviado")).status, 409) // no se saltean estados
    assert.equal((await status(id, "cancelado")).status, 400)
    assert.equal((await status(id, "pagado")).status, 200)
    assert.equal(await stock(RTX), rtx - 2)
    assert.equal(await stock(TECLADO), teclado - 1)

    assert.equal((await status(id, "pagado")).status, 409) // no se paga dos veces
    assert.equal((await status(id, "pendiente")).status, 409) // no se vuelve atrás
    assert.equal((await status(id, "enviado")).status, 200)
    assert.equal((await status(id, "entregado")).status, 200)
    assert.equal((await status(id, "entregado")).status, 409) // estado final
    assert.equal(await stock(RTX), rtx - 2) // enviar y entregar no tocan el stock
  })

  test("ids inválidos, pedido inexistente y pedido sin ítems", async () => {
    assert.equal((await status("xx", "pagado")).status, 400)
    assert.equal((await status(NO_EXISTE, "pagado")).status, 404)
    const empty = (await api("POST", "/orders", { userId: JUAN })).body.data._id
    assert.equal((await status(empty, "pagado")).status, 409)
    await api("DELETE", `/orders/${empty}`)
  })

  test("si falta stock al pagar se revierte todo el pago", async () => {
    // los ítems sueltos no validan stock: dos pedidos piden toda la RTX disponible
    const disponible = await stock(RTX)
    const teclado = await stock(TECLADO)
    const a = (await api("POST", "/orders", { userId: JUAN })).body.data._id
    const b = (await api("POST", "/orders", { userId: JUAN })).body.data._id
    await api("POST", "/order-items", { orderId: a, productId: RTX, quantity: disponible })
    await api("POST", "/order-items", { orderId: b, productId: TECLADO, quantity: 1 })
    await api("POST", "/order-items", { orderId: b, productId: RTX, quantity: 1 })

    assert.equal((await status(a, "pagado")).status, 200)
    const res = await status(b, "pagado")
    assert.equal(res.status, 409)
    assert.equal(res.body.data.productId, RTX)
    // el teclado de b no se descontó y b sigue pendiente
    assert.equal(await stock(TECLADO), teclado)
    assert.equal((await api("GET", `/orders/${b}`)).body.data.status, "pendiente")
    assert.equal(await stock(RTX), 0)
    // la venta que agotó la RTX la dejó "sin stock"
    assert.equal((await api("GET", `/products/${RTX}`)).body.data.status, "sin stock")
    await api("DELETE", `/orders/${b}`)
  })

  test("dos pagos simultáneos del mismo pedido descuentan el stock una sola vez", async () => {
    const teclado = await stock(TECLADO)
    const id = (await api("POST", "/orders/checkout", { userId: JUAN, items: [{ productId: TECLADO, quantity: 2 }] })).body.data.order._id
    const results = await Promise.all([status(id, "pagado"), status(id, "pagado")])
    assert.deepEqual(results.map((r) => r.status).sort(), [200, 409])
    assert.equal(await stock(TECLADO), teclado - 2)
  })
})

// va después de "estados del pedido": Juan ya tiene pedidos pagados con la RTX y el teclado
describe("reseñas (Epic 3)", () => {
  let luisToken: string
  const rating = async (id: string) => (await api("GET", `/products/${id}`, undefined, { token: null })).body.data.rating
  // el autor de la reseña sale del token, no del cuerpo
  const review = (token: string, body: Record<string, unknown>) => api("POST", "/reviews", body, { token })

  before(async () => {
    await api("POST", "/auth/register", { name: "Luis", email: "luis@mail.com", address: "Calle 2", password: "luis12345" }, { token: null })
    await confirmEmail("luis@mail.com")
    luisToken = await login("luis@mail.com", "luis12345")
  })

  test("solo puede reseñar quien compró el producto (pedido pagado o posterior)", async () => {
    const base = { productId: TECLADO, rating: 5, comment: "Muy bueno" }
    assert.equal((await review(luisToken, base)).status, 403)
    // mandar otro userId en el cuerpo no sirve para reseñar en nombre de Juan
    assert.equal((await review(luisToken, { ...base, userId: JUAN })).status, 403)

    // un pedido pendiente todavía no cuenta como compra
    const pending = (await api("POST", "/orders/checkout", { items: [{ productId: TECLADO, quantity: 1 }] }, { token: luisToken })).body.data.order._id
    assert.equal((await review(luisToken, base)).status, 403)
    await api("DELETE", `/orders/${pending}`, undefined, { token: luisToken })

    assert.equal((await review(juanToken, { ...base, productId: NO_EXISTE })).status, 404)
    assert.equal((await review(juanToken, { ...base, productId: "xx" })).status, 400)
    assert.equal((await api("POST", "/reviews", base, { token: null })).status, 401)
  })

  test("valida calificación y comentario", async () => {
    const base = { productId: TECLADO, rating: 4, comment: "Bien" }
    for (const value of [0, 6, 3.5, "5", null]) {
      assert.equal((await review(juanToken, { ...base, rating: value })).status, 400, `rating ${value}`)
    }
    assert.equal((await review(juanToken, { ...base, comment: "   " })).status, 400)
    assert.equal((await review(juanToken, { ...base, comment: "a".repeat(1001) })).status, 400)
    assert.equal((await review(juanToken, { productId: TECLADO, rating: 4 })).status, 400)
  })

  test("el promedio del producto se recalcula al crear, modificar y borrar reseñas", async () => {
    assert.equal(await rating(RTX), undefined) // sin reseñas no hay promedio

    const juanReview = await review(juanToken, { productId: TECLADO, rating: 4, comment: "  Buen teclado  " })
    assert.equal(juanReview.status, 201)
    assert.equal(juanReview.body.data.comment, "Buen teclado")
    assert.equal(juanReview.body.data.userId, JUAN)
    assert.deepEqual(await rating(TECLADO), { average: 4, count: 1 })
    assert.equal((await review(juanToken, { productId: TECLADO, rating: 1, comment: "otra" })).status, 409)

    // Luis compra y paga el teclado: ahora sí puede reseñarlo
    const order = (await api("POST", "/orders/checkout", { items: [{ productId: TECLADO, quantity: 1 }] }, { token: luisToken })).body.data.order._id
    assert.equal((await api("PATCH", `/orders/${order}/status`, { status: "pagado" }, { token: luisToken })).status, 200)
    const luisReview = (await review(luisToken, { productId: TECLADO, rating: 1, comment: "Llegó fallado" })).body.data
    assert.deepEqual(await rating(TECLADO), { average: 2.5, count: 2 })

    const list = await api("GET", `/reviews?productId=${TECLADO}`, undefined, { token: null })
    assert.equal(list.body.data.length, 2)
    // el autor se ve abreviado (nombre e inicial del apellido) y nunca con su email
    assert.deepEqual(list.body.data.map((r: { author: string }) => r.author).sort(), ["Juan P.", "Luis"])
    assert.ok(list.body.data.every((r: object) => !("email" in r)))
    assert.equal((await api("GET", `/reviews/${luisReview._id}`, undefined, { token: null })).body.data.author, "Luis")
    assert.equal((await api("GET", "/reviews?productId=xx")).status, 400)

    const editLuis = (body: unknown, token = luisToken) => api("PATCH", `/reviews/${luisReview._id}`, body, { token })
    assert.equal((await editLuis({ rating: 2 })).status, 200)
    assert.deepEqual(await rating(TECLADO), { average: 3, count: 2 })
    assert.equal((await editLuis({ rating: 5 }, juanToken)).status, 403) // no es su reseña
    assert.equal((await editLuis({ userId: JUAN })).status, 400)
    assert.equal((await editLuis({})).status, 400)
    assert.equal((await editLuis({ rating: 9 })).status, 400)
    assert.equal((await api("PATCH", `/reviews/${NO_EXISTE}`, { rating: 3 })).status, 404)

    assert.equal((await api("DELETE", `/reviews/${juanReview.body.data._id}`, undefined, { token: luisToken })).status, 403)
    assert.equal((await api("DELETE", `/reviews/${juanReview.body.data._id}`, undefined, { token: juanToken })).status, 200)
    assert.deepEqual(await rating(TECLADO), { average: 2, count: 1 })
    // el admin puede borrar cualquier reseña (moderación)
    assert.equal((await api("DELETE", `/reviews/${luisReview._id}`)).status, 200)
    assert.equal(await rating(TECLADO), undefined)
    assert.equal((await api("DELETE", `/reviews/${luisReview._id}`)).status, 404)
  })

  test("ids inválidos e inexistentes", async () => {
    assert.equal((await api("GET", "/reviews/xx")).status, 400)
    assert.equal((await api("GET", `/reviews/${NO_EXISTE}`)).status, 404)
    assert.equal((await api("DELETE", "/reviews/xx")).status, 400)
  })
})

describe("descuentos (CRUD dependiente de categoría)", () => {
  const DAY = 24 * 60 * 60 * 1000
  const iso = (days: number) => new Date(Date.now() + days * DAY).toISOString()
  const discount = (body: Record<string, unknown>) => api("POST", "/discounts", body)
  const vigente = { categoryId: PERIFERICOS, percentage: 10, startDate: iso(-1), endDate: iso(1) }

  test("validaciones del alta y la modificación", async () => {
    for (const percentage of [0, 101, 12.5, "10", null]) {
      assert.equal((await discount({ ...vigente, percentage })).status, 400, `percentage ${percentage}`)
    }
    assert.equal((await discount({ ...vigente, categoryId: "xx" })).status, 400)
    assert.equal((await discount({ ...vigente, categoryId: NO_EXISTE })).status, 404)
    assert.equal((await discount({ ...vigente, startDate: "no-es-fecha" })).status, 400)
    assert.equal((await discount({ ...vigente, endDate: undefined })).status, 400)
    assert.equal((await discount({ ...vigente, endDate: vigente.startDate })).status, 400)
    assert.equal((await discount({ ...vigente, endDate: iso(-2) })).status, 400)

    const created = await discount(vigente)
    assert.equal(created.status, 201)
    const id = created.body.data._id
    assert.equal((await api("PATCH", `/discounts/${id}`, {})).status, 400)
    // la fecha nueva se compara con la que ya estaba guardada
    assert.equal((await api("PATCH", `/discounts/${id}`, { endDate: iso(-2) })).status, 400)
    assert.equal((await api("PATCH", `/discounts/${id}`, { categoryId: NO_EXISTE })).status, 404)
    assert.equal((await api("PATCH", `/discounts/${id}`, { percentage: 20 })).body.data.percentage, 20)
    assert.equal((await api("PATCH", `/discounts/${NO_EXISTE}`, { percentage: 20 })).status, 404)

    const list = (await api("GET", `/discounts?categoryId=${PERIFERICOS}`)).body.data
    assert.ok(list.some((d: any) => d._id === id))
    assert.equal((await api("GET", "/discounts?categoryId=xx")).status, 400)
    assert.equal((await api("GET", "/discounts/xx")).status, 400)
    assert.equal((await api("GET", `/discounts/${NO_EXISTE}`)).status, 404)
    assert.equal((await api("DELETE", `/discounts/${id}`)).status, 200)
    assert.equal((await api("DELETE", `/discounts/${id}`)).status, 404)
  })

  test("el checkout aplica el mayor descuento vigente de la categoría", async () => {
    const ids = [
      await discount({ ...vigente, percentage: 10 }),
      await discount({ ...vigente, percentage: 25 }),
      await discount({ ...vigente, percentage: 50, startDate: iso(-10), endDate: iso(-5) }), // vencido
      await discount({ ...vigente, percentage: 80, startDate: iso(5), endDate: iso(10) }), // futuro
    ].map((r) => r.body.data._id)

    const res = await api("POST", "/orders/checkout", { userId: JUAN, items: [{ productId: TECLADO, quantity: 2 }] })
    assert.equal(res.body.data.items[0].unitPrice, 90) // 120 - 25%
    assert.equal(res.body.data.items[0].subtotal, 180)
    assert.equal(res.body.data.order.total, 180)
    await api("DELETE", `/orders/${res.body.data.order._id}`)

    for (const id of ids) await api("DELETE", `/discounts/${id}`)
    const sinDescuento = await api("POST", "/orders/checkout", { userId: JUAN, items: [{ productId: TECLADO, quantity: 1 }] })
    assert.equal(sinDescuento.body.data.items[0].unitPrice, 120)
    await api("DELETE", `/orders/${sinDescuento.body.data.order._id}`)
  })

  test("los ítems sueltos congelan el precio con descuento, redondeado al centavo", async () => {
    const cat = (await api("POST", "/categories", { name: "Cables", description: "Cables y adaptadores" })).body.data._id
    const prod = (await api("POST", "/products", { name: "Cable HDMI", description: "2 metros", price: 19.99, stock: 5, status: "disponible", categoryId: cat })).body.data._id
    const d = (await discount({ ...vigente, categoryId: cat, percentage: 10 })).body.data._id

    const order = (await api("POST", "/orders", { userId: JUAN })).body.data._id
    const item = (await api("POST", "/order-items", { orderId: order, productId: prod, quantity: 3 })).body.data
    assert.equal(item.unitPrice, 17.99) // 19.99 - 10% = 17.991 → 17.99
    assert.equal(item.subtotal, 53.97)
    assert.equal((await api("GET", `/orders/${order}`)).body.data.total, 53.97)

    // el precio quedó congelado: borrar el descuento no cambia el ítem
    await api("DELETE", `/discounts/${d}`)
    assert.equal((await api("GET", `/order-items/${item._id}`)).body.data.unitPrice, 17.99)

    await api("DELETE", `/orders/${order}`)
    await api("DELETE", `/products/${prod}`)
    assert.equal((await api("DELETE", `/categories/${cat}`)).status, 200)
  })

  test("no se borra una categoría con descuentos", async () => {
    const cat = (await api("POST", "/categories", { name: "Monitores", description: "Pantallas" })).body.data._id
    const d = (await discount({ ...vigente, categoryId: cat })).body.data._id
    const res = await api("DELETE", `/categories/${cat}`)
    assert.equal(res.status, 409)
    assert.equal(res.body.message, "La categoría tiene descuentos asociados")
    await api("DELETE", `/discounts/${d}`)
    assert.equal((await api("DELETE", `/categories/${cat}`)).status, 200)
  })
})

describe("autenticación y permisos", () => {
  let sofia: string
  let sofiaToken: string
  const asSofia = (method: string, path: string, body?: unknown) => api(method, path, body, { token: sofiaToken })

  before(async () => {
    const res = await api("POST", "/auth/register", { name: "Sofía", email: "sofia@mail.com", address: "Calle 3", password: "sofia12345" }, { token: null })
    sofia = res.body.data._id
    await confirmEmail("sofia@mail.com")
    sofiaToken = await login("sofia@mail.com", "sofia12345")
  })

  test("registro: crea clientes, valida la contraseña y nunca devuelve el hash", async () => {
    const res = await api("POST", "/auth/register", { name: "Pedro", email: "pedro@mail.com", address: "x", password: "pedro12345" }, { token: null })
    assert.equal(res.status, 201)
    assert.equal(res.body.data.role, "cliente")
    assert.equal(res.body.data.passwordHash, undefined)
    assert.equal(res.body.data.emailToken, undefined)
    const base = { name: "Otro", email: "otro@mail.com", address: "x" }
    assert.equal((await api("POST", "/auth/register", { ...base, password: "corta" }, { token: null })).status, 400)
    assert.equal((await api("POST", "/auth/register", base, { token: null })).status, 400)
    // nadie se registra como admin por su cuenta
    assert.equal((await api("POST", "/auth/register", { ...base, password: "otro12345", role: "admin" }, { token: null })).status, 403)
    assert.equal((await api("POST", "/auth/register", { ...base, email: "pedro@mail.com", password: "otro12345" }, { token: null })).status, 409)
  })

  test("confirmación de email: sin confirmar no entra, el link sirve una sola vez", async () => {
    const login = () => api("POST", "/auth/login", { email: "pedro@mail.com", password: "pedro12345" }, { token: null })
    const pending = await login()
    assert.equal(pending.status, 403)
    assert.match(pending.body.message, /pedro@mail.com/)

    assert.equal((await api("GET", "/auth/confirm/token-trucho", undefined, { token: null })).status, 404)
    const { db } = await import("../shared/db/conn.js")
    const token = (await db.collection("users").findOne({ email: "pedro@mail.com" }))!.emailToken
    const ok = await api("GET", `/auth/confirm/${token}`, undefined, { token: null })
    assert.equal(ok.status, 200)
    assert.equal(ok.body.data.emailConfirmed, true)
    assert.equal(ok.body.data.emailToken, undefined)
    assert.equal((await api("GET", `/auth/confirm/${token}`, undefined, { token: null })).status, 404)

    const logged = await login()
    assert.equal(logged.status, 200)
    assert.equal(logged.body.data.user.emailToken, undefined)
  })

  test("login y sesión", async () => {
    const ok = await api("POST", "/auth/login", { email: " SOFIA@mail.com ", password: "sofia12345" }, { token: null })
    assert.equal(ok.status, 200)
    assert.ok(ok.body.data.token)
    assert.equal(ok.body.data.user.passwordHash, undefined)

    // mismo mensaje con email inexistente o contraseña incorrecta
    const wrong = await api("POST", "/auth/login", { email: "sofia@mail.com", password: "incorrecta" }, { token: null })
    const unknown = await api("POST", "/auth/login", { email: "nadie@mail.com", password: "sofia12345" }, { token: null })
    assert.equal(wrong.status, 401)
    assert.equal(unknown.status, 401)
    assert.equal(wrong.body.message, unknown.body.message)
    assert.equal((await api("POST", "/auth/login", { email: "sofia@mail.com" }, { token: null })).status, 400)

    assert.equal((await asSofia("GET", "/auth/me")).body.data.email, "sofia@mail.com")
    assert.equal((await api("GET", "/auth/me", undefined, { token: null })).status, 401)
    assert.equal((await api("GET", "/auth/me", undefined, { token: "token.trucho.firmado" })).status, 401)
    assert.equal((await api("GET", "/auth/me", undefined, { token: sofiaToken.slice(0, -2) + "xx" })).status, 401)
  })

  test("catálogo: leer es público, escribir es solo para admin", async () => {
    assert.equal((await api("GET", "/categories", undefined, { token: null })).status, 200)
    assert.equal((await api("GET", "/products", undefined, { token: null })).status, 200)
    assert.equal((await api("GET", "/discounts", undefined, { token: null })).status, 200)
    const cat = { name: "X", description: "Y" }
    assert.equal((await api("POST", "/categories", cat, { token: null })).status, 401)
    assert.equal((await asSofia("POST", "/categories", cat)).status, 403)
    assert.equal((await asSofia("PATCH", `/products/${RTX}`, { price: 1 })).status, 403)
    assert.equal((await asSofia("DELETE", `/categories/${PLACAS}`)).status, 403)
    assert.equal((await asSofia("POST", "/discounts", { categoryId: PLACAS, percentage: 90 })).status, 403)
    // los ítems sueltos son solo para admin: el cliente usa el checkout
    assert.equal((await asSofia("GET", "/order-items")).status, 403)
  })

  test("usuarios: el cliente solo ve y modifica su propio usuario y no cambia su rol", async () => {
    assert.equal((await asSofia("GET", "/users")).status, 403)
    const all = await api("GET", "/users")
    assert.equal(all.status, 200)
    assert.ok(all.body.data.every((u: any) => u.passwordHash === undefined))

    assert.equal((await asSofia("GET", `/users/${sofia}`)).status, 200)
    assert.equal((await asSofia("GET", `/users/${JUAN}`)).status, 403)
    assert.equal((await asSofia("PATCH", `/users/${JUAN}`, { address: "hack" })).status, 403)
    assert.equal((await asSofia("PATCH", `/users/${sofia}`, { role: "admin" })).status, 403)
    assert.equal((await asSofia("DELETE", `/users/${sofia}`)).status, 403)

    const updated = await asSofia("PATCH", `/users/${sofia}`, { address: "Calle Nueva 10" })
    assert.equal(updated.body.data.address, "Calle Nueva 10")
    assert.equal(updated.body.data.passwordHash, undefined)

    // cambiar la contraseña: la vieja deja de funcionar
    assert.equal((await asSofia("PATCH", `/users/${sofia}`, { password: "nueva12345" })).status, 200)
    assert.equal((await api("POST", "/auth/login", { email: "sofia@mail.com", password: "sofia12345" }, { token: null })).status, 401)
    sofiaToken = await login("sofia@mail.com", "nueva12345")
    assert.ok(sofiaToken)
  })

  test("pedidos: el cliente compra para sí mismo y solo ve y toca los suyos", async () => {
    assert.equal((await api("GET", "/orders", undefined, { token: null })).status, 401)

    // aunque mande el userId de Juan, el pedido queda a nombre de Sofía
    const checkout = await asSofia("POST", "/orders/checkout", { userId: JUAN, items: [{ productId: TECLADO, quantity: 1 }] })
    assert.equal(checkout.status, 201)
    const mine = checkout.body.data.order
    assert.equal(mine.userId, sofia)

    const list = await asSofia("GET", `/orders?userId=${JUAN}`)
    assert.ok(list.body.data.length > 0)
    assert.ok(list.body.data.every((o: any) => o.userId === sofia))

    const juanOrder = "674a1b2c3d4e5f6789012346" // pedido pendiente de Juan del seed
    assert.equal((await asSofia("GET", `/orders/${juanOrder}`)).status, 403)
    assert.equal((await asSofia("PATCH", `/orders/${juanOrder}/status`, { status: "pagado" })).status, 403)
    assert.equal((await asSofia("DELETE", `/orders/${juanOrder}`)).status, 403)
    assert.equal((await asSofia("PATCH", `/orders/${mine._id}`, { userId: sofia })).status, 403)

    assert.equal((await asSofia("GET", `/orders/${mine._id}`)).body.data.items.length, 1)
    assert.equal((await asSofia("PATCH", `/orders/${mine._id}/status`, { status: "pagado" })).status, 200)
    // enviar y entregar es tarea del admin
    assert.equal((await asSofia("PATCH", `/orders/${mine._id}/status`, { status: "enviado" })).status, 403)
    assert.equal((await api("PATCH", `/orders/${mine._id}/status`, { status: "enviado" })).status, 200)
  })
})
