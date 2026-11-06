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
  rating?: { average: number; count: number }
}
export type Discount = { _id: string; categoryId: string; percentage: number; startDate: string; endDate: string }
export type OrderStatus = "pendiente" | "pagado" | "enviado" | "entregado"
export type OrderItem = { _id: string; orderId: string; productId: string; quantity: number; unitPrice: number; subtotal: number }
export type Order = { _id: string; userId: string; date: string; status: OrderStatus; total: number; items?: OrderItem[] }
export type Review = { _id: string; userId: string; productId: string; rating: number; comment: string; date: string }

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
