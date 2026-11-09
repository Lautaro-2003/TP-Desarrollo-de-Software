import { useEffect, useState } from "react"
import { Link, useNavigate, useParams } from "react-router"
import { api, ApiError, Category, Order, OrderStatus, Product, User, date, designators, money } from "../api"
import { useSession } from "../session"
import { Ref } from "./Catalog"

const STEPS: OrderStatus[] = ["pendiente", "pagado", "enviado", "entregado"]
const LABEL: Record<OrderStatus, string> = { pendiente: "Pendiente", pagado: "Pagado", enviado: "Enviado", entregado: "Entregado" }
const NEXT: Partial<Record<OrderStatus, OrderStatus>> = { pendiente: "pagado", pagado: "enviado", enviado: "entregado" }
const ACTION: Record<OrderStatus, string> = { pendiente: "", pagado: "Pagar", enviado: "Marcar enviado", entregado: "Marcar entregado" }

export function StatusBadge({ status }: { status: OrderStatus }) {
  return <span className={`status ${status}`}>{LABEL[status]}</span>
}

// el avance del pedido como una pista entre vías: lo recorrido queda en dorado
function Trace({ status }: { status: OrderStatus }) {
  const at = STEPS.indexOf(status)
  return (
    <ol className="trace" aria-label="Avance del pedido">
      {STEPS.map((s, i) => (
        <li key={s} className={i < at ? "done" : i === at ? "now" : undefined} aria-current={i === at ? "step" : undefined}>
          <span className="via" />
          {LABEL[s]}
        </li>
      ))}
    </ol>
  )
}

// el cliente ve solo sus pedidos (lo filtra el backend); el admin ve todos con el nombre del comprador
export function MyOrders() {
  const { user } = useSession()
  const [orders, setOrders] = useState<Order[] | null>(null)
  const [users, setUsers] = useState<User[]>([])
  const admin = user?.role === "admin"

  useEffect(() => {
    api<Order[]>("GET", "/orders").then((list) => setOrders([...list].sort((a, b) => b.date.localeCompare(a.date))))
    if (admin) api<User[]>("GET", "/users").then(setUsers)
  }, [user])

  return (
    <section className="module contained">
      <div className="module-head">
        <h1>{admin ? "Pedidos" : "Mis pedidos"}</h1>
        {orders && <span className="meta">{orders.length === 1 ? "1 pedido" : `${orders.length} pedidos`}</span>}
      </div>
      {orders === null && <p className="empty">Cargando…</p>}
      {orders?.length === 0 && (
        <div className="empty">
          <p>Todavía no hay pedidos.</p>
          {!admin && (
            <Link className="button" to="/">
              Ver el catálogo
            </Link>
          )}
        </div>
      )}
      {orders && orders.length > 0 && (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Fecha</th>
                {admin && <th>Cliente</th>}
                <th>Estado</th>
                <th className="n">Total</th>
                <th>
                  <span className="sr-only">Detalle</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {orders.map((o) => (
                <tr key={o._id}>
                  <td>{date(o.date)}</td>
                  {admin && <td>{users.find((u) => u._id === o.userId)?.name ?? "…"}</td>}
                  <td>
                    <StatusBadge status={o.status} />
                  </td>
                  <td className="n price">{money(o.total)}</td>
                  <td className="n">
                    <Link to={`/pedidos/${o._id}`}>Ver detalle</Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
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
  const [categories, setCategories] = useState<Category[]>([])
  const [error, setError] = useState("")

  const load = () => api<Order>("GET", `/orders/${id}`).then(setOrder).catch((err) => setError(err.message))
  useEffect(() => {
    load()
    api<Product[]>("GET", "/products").then(setProducts)
    api<Category[]>("GET", "/categories").then(setCategories)
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
  const refs = designators(products, categories)

  return (
    <>
      <nav className="crumbs" aria-label="Ubicación">
        <ol>
          <li>
            <Link to="/pedidos">{user?.role === "admin" ? "Pedidos" : "Mis pedidos"}</Link>
          </li>
          <li aria-current="page">Pedido del {date(order.date)}</li>
        </ol>
      </nav>
      <div className="split">
        <section className="module">
          <div className="module-head">
            <h1>Pedido del {date(order.date)}</h1>
          </div>
          <Trace status={order.status} />
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Ref.</th>
                  <th>Producto</th>
                  <th className="n">Precio unitario</th>
                  <th className="n">Cantidad</th>
                  <th className="n">Subtotal</th>
                </tr>
              </thead>
              <tbody>
                {order.items?.map((i) => (
                  <tr key={i._id}>
                    <td>
                      <Ref value={refs.get(i.productId)} />
                    </td>
                    <td>{products.find((p) => p._id === i.productId)?.name ?? "…"}</td>
                    <td className="n">{money(i.unitPrice)}</td>
                    <td className="n">{i.quantity}</td>
                    <td className="n">{money(i.subtotal)}</td>
                  </tr>
                ))}
                <tr className="totals">
                  <td colSpan={4} className="n">
                    Total
                  </td>
                  <td className="n price">{money(order.total)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>
  
        <aside className="module summary">
          <div className="module-head">
            <h2>Resumen</h2>
          </div>
          <div className="module-body">
            <dl>
              <dt>Estado</dt>
              <dd>
                <StatusBadge status={order.status} />
              </dd>
              <dt>Fecha</dt>
              <dd>{date(order.date)}</dd>
              <dt>Productos</dt>
              <dd>{order.items?.reduce((sum, i) => sum + i.quantity, 0) ?? "…"}</dd>
              <dt className="grand">Total</dt>
              <dd className="grand">{money(order.total)}</dd>
            </dl>
            {next && !canAdvance && <p className="muted small">El envío y la entrega los marca la tienda.</p>}
            {error && <p className="error">{error}</p>}
            {canAdvance && (
              <button onClick={() => run(() => api("PATCH", `/orders/${order._id}/status`, { status: next }).then(load))}>{ACTION[next]}</button>
            )}
            {order.status === "pendiente" && (
              <button className="secondary" onClick={() => run(() => api("DELETE", `/orders/${order._id}`).then(() => navigate("/pedidos")))}>
                Cancelar pedido
              </button>
            )}
          </div>
        </aside>
      </div>
    </>
  )
}
