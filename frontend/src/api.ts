// tipos de la API (los _id y las fechas llegan como string en el JSON)
export type Role = "cliente" | "admin"
export type User = { _id: string; name: string; email: string; address: string; role: Role }
export type Category = { _id: string; name: string; description: string }
export type Product = {
  _id: string
  name: string
  description: string
  price: number
  stock: number
  status: string
  categoryId: string
  slug?: string
  image?: string
  rating?: { average: number; count: number }
}

// la URL del producto usa su slug (/productos/rtx-4070); los productos viejos sin slug caen al id
export const productPath = (p: Product) => `/productos/${p.slug || p._id}`
export type Discount = { _id: string; categoryId: string; percentage: number; startDate: string; endDate: string }
export type OrderStatus = "pendiente" | "pagado" | "enviado" | "entregado"
export type OrderItem = { _id: string; orderId: string; productId: string; quantity: number; unitPrice: number; subtotal: number }
export type Order = { _id: string; userId: string; date: string; status: OrderStatus; total: number; items?: OrderItem[] }
// author llega abreviado desde el backend ("María G.")
export type Review = { _id: string; userId: string; productId: string; rating: number; comment: string; date: string; author: string }

const TOKEN_KEY = "tienda.token"

export const tokenStore = {
  get: () => localStorage.getItem(TOKEN_KEY),
  set: (token: string) => localStorage.setItem(TOKEN_KEY, token),
  clear: () => localStorage.removeItem(TOKEN_KEY),
}

export class ApiError extends Error {
  constructor(public status: number, message: string, public data?: unknown) {
    super(message)
  }
}

// llama a la API con el token de la sesión y devuelve el campo data de la respuesta
export async function api<T>(method: string, path: string, body?: unknown): Promise<T> {
  const headers: Record<string, string> = {}
  const token = tokenStore.get()
  if (token) headers.Authorization = `Bearer ${token}`
  if (body !== undefined) headers["Content-Type"] = "application/json"

  const res = await fetch(`/api${path}`, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) })
  const json = await res.json().catch(() => ({}))
  if (!res.ok) throw new ApiError(res.status, json.message ?? "Error inesperado", json.data)
  return json.data as T
}

export const money = (value: number) => value.toLocaleString("es-AR", { style: "currency", currency: "ARS" })
export const date = (value: string) => new Date(value).toLocaleDateString("es-AR")

// mismo criterio que el backend: el mayor descuento vigente de la categoría, redondeado al centavo
export function discountFor(discounts: Discount[], categoryId: string, now = new Date()): number {
  return discounts
    .filter((d) => d.categoryId === categoryId && new Date(d.startDate) <= now && now < new Date(d.endDate))
    .reduce((best, d) => Math.max(best, d.percentage), 0)
}
export const withDiscount = (price: number, percentage: number) => Math.round(price * (100 - percentage)) / 100

// prefijo serigrafiado de cada categoría; las que se creen después usan sus tres primeras letras
const PREFIX: Record<string, string> = {
  "Placas de Video": "VGA",
  Periféricos: "PER",
  Almacenamiento: "ALM",
  Monitores: "MON",
  Procesadores: "CPU",
  "Memorias RAM": "RAM",
}
export const prefixFor = (name = "") =>
  PREFIX[name] ?? (name.normalize("NFD").replace(/[^A-Za-z]/g, "").slice(0, 3).toUpperCase() || "REF")

// designador de cada producto (VGA1, ALM2): prefijo de su categoría + su orden de alta dentro de ella
export function designators(products: Product[], categories: Category[]) {
  const refs = new Map<string, string>()
  const count: Record<string, number> = {}
  for (const p of [...products].sort((a, b) => a._id.localeCompare(b._id))) {
    const prefix = prefixFor(categories.find((c) => c._id === p.categoryId)?.name)
    count[prefix] = (count[prefix] ?? 0) + 1
    refs.set(p._id, `${prefix}${count[prefix]}`)
  }
  return refs
}
