import { useEffect, useState } from "react"
import { Link, useLocation, useNavigate, useParams } from "react-router"
import { api, ApiError, Category, Order, OrderStatus, Product, User, date, designators, money, productPath } from "../api"
import { useSession } from "../session"
import { Thumb } from "../ui"
import { Ref } from "./Catalog"

const STEPS: OrderStatus[] = ["pendiente", "pagado", "enviado", "entregado"]
const LABEL: Record<OrderStatus, string> = { pendiente: "Pendiente", pagado: "Pagado", enviado: "Enviado", entregado: "Entregado" }
const NEXT: Partial<Record<OrderStatus, OrderStatus>> = { pendiente: "pagado", pagado: "enviado", enviado: "entregado" }
const ACTION: Record<OrderStatus, string> = { pendiente: "", pagado: "Pagar", enviado: "Marcar como enviado", entregado: "Marcar como entregado" }

// renglón del pedido: miniatura y nombre con enlace (un producto ya borrado queda solo con "…")
function ItemName({ product }: { product?: Product }) {
  if (!product) return <>…</>
  return (
    <>
      <Thumb product={product} />
      <Link className="name" to={productPath(product)}>
        {product.name}
      </Link>
    </>
  )
}

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

// el cliente ve solo sus pedidos (lo filtra el backend) dentro de su cuenta; el admin ve todos con el nombre del comprador
export function MyOrders() {
  const { user } = useSession()
  const [orders, setOrders] = useState<Order[] | null>(null)
  const [users, setUsers] = useState<User[]>([])
  const admin = user?.role === "admin"
  const Title = admin ? "h1" : "h2"

  useEffect(() => {
    api<Order[]>("GET", "/orders").then((list) => setOrders([...list].sort((a, b) => b.date.localeCompare(a.date))))
    if (admin) api<User[]>("GET", "/users").then(setUsers)
  }, [user])

  return (
    <section className="module contained">
      <div className="module-head">
        <Title>{admin ? "Pedidos" : "Mis pedidos"}</Title>
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
                    <Link to={`/pedidos/${o._id}`}>{!admin && o.status === "pendiente" ? "Pagar o cancelar" : "Ver detalle"}</Link>
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
  // el checkout llega con created: se avisa que el pedido falta pagarlo
  const created = (useLocation().state as { created?: boolean } | null)?.created
  const admin = user?.role === "admin"
  const back = admin ? { to: "/pedidos", label: "Pedidos" } : { to: "/cuenta", label: "Mi cuenta" }
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
      setError(await describe(err))
    }
  }

  // si el pago falla por stock, se nombra el producto con su stock actual y se dice cómo seguir
  async function describe(err: unknown) {
    if (!(err instanceof ApiError)) return "No se pudo completar la acción"
    const productId = (err.data as { productId?: string } | undefined)?.productId
    if (!productId) return err.message
    const fresh = await api<Product[]>("GET", "/products")
    setProducts(fresh)
    const p = fresh.find((x) => x._id === productId)
    const what = p ? `${p.name} (quedan ${p.stock})` : "un producto del pedido"
    return `No alcanza el stock de ${what}. Cancelá este pedido y armá uno nuevo con lo disponible.`
  }

  if (!order) return error ? <p className="error">{error}</p> : <p className="muted">Cargando…</p>
  const next = NEXT[order.status]
  // pagar lo puede hacer el dueño; enviar y entregar solo el admin (el backend vuelve a validarlo)
  const canAdvance = next && (next === "pagado" || admin)
  // el admin no paga: registra un pago que entró por afuera (transferencia, efectivo)
  const actionLabel = next === "pagado" && admin ? "Marcar como pagado" : next && ACTION[next]
  const refs = designators(products, categories)

  // pagar descuenta stock y el pedido ya no se puede cancelar: se confirma antes
  function advance(status: OrderStatus) {
    const question = admin
      ? "¿Marcar como pagado? Hacelo solo si el pago ya entró: se descuenta el stock y no se puede deshacer."
      : `¿Pagar ${money(order!.total)}? Después ya no vas a poder cancelar el pedido.`
    if (status === "pagado" && !confirm(question)) return
    run(() => api("PATCH", `/orders/${order!._id}/status`, { status }).then(load))
  }

  return (
    <>
      <nav className="crumbs" aria-label="Ubicación">
        <ol>
          <li>
            <Link to={back.to}>{back.label}</Link>
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
                  <th className="fit">Ref.</th>
                  <th>Producto</th>
                  <th className="n">Precio unitario</th>
                  <th className="n">Cantidad</th>
                  <th className="n">Subtotal</th>
                </tr>
              </thead>
              <tbody>
                {order.items?.map((i) => (
                  <tr key={i._id}>
                    <td className="fit">
                      <Ref value={refs.get(i.productId)} />
                    </td>
                    <td className="with-thumb">
                      <ItemName product={products.find((p) => p._id === i.productId)} />
                    </td>
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
            {order.status === "pendiente" && (
              <p className={created ? "notice" : "muted small"} role={created ? "status" : undefined}>
                {created && "Pedido creado. "}
                {admin ? "El cliente todavía no lo pagó" : "Falta pagarlo"}: el stock se reserva recién al pagar.
              </p>
            )}
            {error && <p className="error">{error}</p>}
            {canAdvance && <button onClick={() => advance(next)}>{actionLabel}</button>}
            {order.status === "pendiente" && (
              <button
                className="secondary"
                onClick={() =>
                  confirm("¿Cancelar este pedido? Se elimina y no se puede deshacer.") &&
                  run(() => api("DELETE", `/orders/${order._id}`).then(() => navigate(back.to)))
                }
              >
                Cancelar pedido
              </button>
            )}
          </div>
        </aside>
      </div>
    </>
  )
}
