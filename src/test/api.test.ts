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

async function api(method: string, path: string, body?: unknown, raw?: string) {
  const res = await fetch(BASE + path, {
    method,
    headers: body !== undefined || raw !== undefined ? { "Content-Type": "application/json" } : {},
    body: raw ?? (body !== undefined ? JSON.stringify(body) : undefined),
  })
  return { status: res.status, body: (await res.json()) as any }
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
  for (let i = 0; i < 60; i++) {
    try {
      await fetch(BASE + "/categories")
      return
    } catch {
      await new Promise((r) => setTimeout(r, 500))
    }
  }
  throw new Error("El servidor de prueba no arrancó")
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
    const res = await api("POST", "/categories", undefined, "{ nombre: ")
    assert.equal(res.status, 400)
  })
})

describe("categorías", () => {
  test("crear, validar y modificar", async () => {
    const created = await api("POST", "/categories", { name: "  Almacenamiento ", description: "SSD y HDD" })
    assert.equal(created.status, 201)
    assert.equal(created.body.data.name, "Almacenamiento")
    assert.equal((await api("POST", "/categories", { description: "sin nombre" })).status, 400)
    assert.equal((await api("POST", "/categories", { name: "", description: "x" })).status, 400)

    const id = created.body.data._id
    assert.equal((await api("PATCH", `/categories/${id}`, {})).status, 400)
    assert.equal((await api("PATCH", `/categories/${id}`, { name: 5 })).status, 400)
    const patched = await api("PATCH", `/categories/${id}`, { description: "Discos" })
    assert.equal(patched.body.data.description, "Discos")
    assert.equal(patched.body.data.name, "Almacenamiento")
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
  test("filtro por categoría", async () => {
    const res = await api("GET", `/products?categoryId=${PLACAS}`)
    assert.deepEqual(res.body.data.map((p: any) => p._id), [RTX])
    assert.equal((await api("GET", "/products?categoryId=xx")).status, 400)
  })
})

describe("usuarios", () => {
  test("alta con email normalizado y rol cliente por defecto", async () => {
    const res = await api("POST", "/users", { name: "Ana", email: " Ana@Mail.COM ", address: "Calle 1" })
    assert.equal(res.status, 201)
    assert.equal(res.body.data.email, "ana@mail.com")
    assert.equal(res.body.data.role, "cliente")
    // el mismo email con otras mayúsculas también es repetido
    assert.equal((await api("POST", "/users", { name: "Ana 2", email: "ANA@mail.com", address: "x" })).status, 409)
    assert.equal((await api("DELETE", `/users/${res.body.data._id}`)).status, 200)
  })
  test("validaciones", async () => {
    assert.equal((await api("POST", "/users", { name: "a", email: "no-es-email", address: "x" })).status, 400)
    assert.equal((await api("POST", "/users", { name: "a", email: "a@b.co", address: "x", role: "root" })).status, 400)
    assert.equal((await api("POST", "/users", { email: "a@b.co", address: "x" })).status, 400)
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
    const id = (await api("POST", "/orders", { userId: JUAN })).body.data._id
    const item = (await api("POST", "/order-items", { orderId: id, productId: RTX, quantity: 1 })).body.data
    assert.equal((await api("PATCH", `/orders/${id}`, { status: "cancelado" })).status, 400)
    assert.equal((await api("PATCH", `/orders/${id}`, { status: "pagado" })).status, 200)

    assert.equal((await api("POST", "/order-items", { orderId: id, productId: RTX, quantity: 1 })).status, 409)
    assert.equal((await api("PATCH", `/order-items/${item._id}`, { quantity: 2 })).status, 409)
    assert.equal((await api("DELETE", `/order-items/${item._id}`)).status, 409)
    assert.equal((await api("PATCH", `/orders/${id}`, { userId: JUAN })).status, 409)
    assert.equal((await api("DELETE", `/orders/${id}`)).status, 409)
    // un producto con ítems de pedido no se puede borrar
    assert.equal((await api("DELETE", `/products/${RTX}`)).status, 409)

    await api("PATCH", `/orders/${id}`, { status: "pendiente" })
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
