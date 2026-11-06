import { useEffect, useState } from "react"
import { Link, useNavigate, useParams } from "react-router"
import { api, ApiError, Order, OrderStatus, Product, User, date, money } from "../api"
import { useSession } from "../session"

const NEXT: Partial<Record<OrderStatus, OrderStatus>> = { pendiente: "pagado", pagado: "enviado", enviado: "entregado" }
const ACTION: Record<OrderStatus, string> = { pendiente: "", pagado: "Pagar", enviado: "Marcar enviado", entregado: "Marcar entregado" }

export function StatusBadge({ status }: { status: OrderStatus }) {
  return <span className={`status ${status}`}>{status}</span>
}

// el cliente ve solo sus pedidos (lo filtra el backend); el admin ve todos con el nombre del comprador
export function MyOrders() {
  const { user } = useSession()
  const [orders, setOrders] = useState<Order[]>([])
  const [users, setUsers] = useState<User[]>([])

  useEffect(() => {
    api<Order[]>("GET", "/orders").then((list) => setOrders([...list].sort((a, b) => b.date.localeCompare(a.date))))
    if (user?.role === "admin") api<User[]>("GET", "/users").then(setUsers)
  }, [user])

  return (
    <section>
      <h1>{user?.role === "admin" ? "Pedidos" : "Mis pedidos"}</h1>
      {orders.length === 0 && (
        <p className="muted">
          Todavía no hay pedidos. <Link to="/">Ver el catálogo</Link>
        </p>
      )}
      {orders.length > 0 && (
        <table>
          <thead>
            <tr>
              <th>Fecha</th>
              {user?.role === "admin" && <th>Cliente</th>}
              <th>Estado</th>
              <th>Total</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {orders.map((o) => (
              <tr key={o._id}>
                <td>{date(o.date)}</td>
                {user?.role === "admin" && <td>{users.find((u) => u._id === o.userId)?.name ?? "…"}</td>}
                <td>
                  <StatusBadge status={o.status} />
                </td>
                <td>{money(o.total)}</td>
                <td>
                  <Link to={`/pedidos/${o._id}`}>Ver detalle</Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  )
}

export function OrderDetail() {
  const { id } = useParams()
  const { user } = useSession()
  const navigate = useNavigate()
  const [order, setOrder] = useState<Order | null>(null)
  const [products, setProducts] = useState<Product[]>([])
  const [error, setError] = useState("")

  const load = () => api<Order>("GET", `/orders/${id}`).then(setOrder).catch((err) => setError(err.message))
  useEffect(() => {
    load()
    api<Product[]>("GET", "/products").then(setProducts)
  }, [id])

  async function run(action: () => Promise<unknown>) {
    setError("")
    try {
      await action()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No se pudo completar la acción")
    }
  }

  if (!order) return error ? <p className="error">{error}</p> : <p className="muted">Cargando…</p>
  const next = NEXT[order.status]
  // pagar lo puede hacer el dueño; enviar y entregar solo el admin (el backend vuelve a validarlo)
  const canAdvance = next && (next === "pagado" || user?.role === "admin")

  return (
    <section className="narrow">
      <Link to="/pedidos">← Volver a pedidos</Link>
      <h1>Pedido del {date(order.date)}</h1>
      <p>
        Estado: <StatusBadge status={order.status} />
      </p>
      <table>
        <thead>
          <tr>
            <th>Producto</th>
            <th>Precio unitario</th>
            <th>Cantidad</th>
            <th>Subtotal</th>
          </tr>
        </thead>
        <tbody>
          {order.items?.map((i) => (
            <tr key={i._id}>
              <td>{products.find((p) => p._id === i.productId)?.name ?? "…"}</td>
              <td>{money(i.unitPrice)}</td>
              <td>{i.quantity}</td>
              <td>{money(i.subtotal)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="total">Total: {money(order.total)}</p>
      {error && <p className="error">{error}</p>}
      {canAdvance && (
        <button onClick={() => run(() => api("PATCH", `/orders/${order._id}/status`, { status: next }).then(load))}>{ACTION[next]}</button>
      )}{" "}
      {order.status === "pendiente" && (
        <button className="secondary" onClick={() => run(() => api("DELETE", `/orders/${order._id}`).then(() => navigate("/pedidos")))}>
          Cancelar pedido
        </button>
      )}
    </section>
  )
}
