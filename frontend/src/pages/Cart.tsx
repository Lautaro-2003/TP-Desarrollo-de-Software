import { useEffect, useState } from "react"
import { Link, useNavigate } from "react-router"
import { api, ApiError, Category, Discount, Order, Product, designators, discountFor, money, withDiscount } from "../api"
import { useSession } from "../session"
import { Ref } from "./Catalog"

// el campo se puede vaciar para tipear otro número sin que el producto salga del carrito:
// solo se guardan enteros de 1 al stock, y al salir del campo vuelve a la cantidad guardada
function QtyInput({ value, max, label, onChange }: { value: number; max: number; label: string; onChange: (q: number) => void }) {
  const [draft, setDraft] = useState(String(value))
  useEffect(() => setDraft(String(value)), [value])

  return (
    <input
      type="number"
      min={1}
      max={max}
      value={draft}
      aria-label={label}
      onChange={(e) => {
        const n = Math.floor(Number(e.target.value))
        if (e.target.value === "" || !(n >= 1)) return setDraft(e.target.value)
        const q = Math.min(n, max)
        setDraft(String(q))
        onChange(q)
      }}
      onBlur={() => setDraft(String(value))}
    />
  )
}

type StockProblem = { name: string; stock: number }

export default function Cart() {
  const { user, cart, setQuantity, clearCart } = useSession()
  const navigate = useNavigate()
  // null = todavía cargando: sin productos no se puede saber qué renglones siguen existiendo
  const [products, setProducts] = useState<Product[] | null>(null)
  const [categories, setCategories] = useState<Category[]>([])
  const [discounts, setDiscounts] = useState<Discount[]>([])
  const [error, setError] = useState("")

  const loadProducts = () => api<Product[]>("GET", "/products").then(setProducts)
  useEffect(() => {
    loadProducts()
    api<Category[]>("GET", "/categories").then(setCategories)
    api<Discount[]>("GET", "/discounts").then(setDiscounts)
  }, [])

  // un producto dado de baja no se puede comprar ni ver en la tabla: se saca del carrito
  useEffect(() => {
    if (!products) return
    for (const item of cart) if (!products.some((p) => p._id === item.productId)) setQuantity(item.productId, 0)
  }, [products])

  const refs = designators(products ?? [], categories)
  const lines = cart.flatMap((item) => {
    const product = products?.find((p) => p._id === item.productId)
    if (!product) return []
    const unit = withDiscount(product.price, discountFor(discounts, product.categoryId))
    return [{ ...item, product, unit, subtotal: unit * item.quantity }]
  })
  const total = lines.reduce((sum, l) => sum + l.subtotal, 0)
  const units = lines.reduce((sum, l) => sum + l.quantity, 0)
  // el stock pudo bajar desde que se armó el carrito: no se confirma hasta ajustar esos renglones
  const overStock = lines.some((l) => l.quantity > l.product.stock)

  // el servidor valida stock y calcula el precio definitivo; acá solo se muestra una estimación
  async function checkout() {
    setError("")
    if (!user) return navigate("/login", { state: { from: "/carrito" } })
    try {
      const data = await api<{ order: Order }>("POST", "/orders/checkout", {
        items: cart.map(({ productId, quantity }) => ({ productId, quantity })),
      })
      clearCart()
      navigate(`/pedidos/${data.order._id}`, { state: { created: true } })
    } catch (err) {
      if (!(err instanceof ApiError)) return setError("No se pudo crear el pedido")
      // si otro cliente compró mientras tanto, se nombra qué falta y se refrescan los stocks de la tabla
      const problems = Array.isArray(err.data) ? (err.data as StockProblem[]) : []
      if (problems.length > 0) loadProducts()
      setError(problems.length ? `No alcanza el stock de ${problems.map((p) => `${p.name} (quedan ${p.stock})`).join(", ")}.` : err.message)
    }
  }

  if (cart.length === 0)
    return (
      <section className="module contained">
        <div className="module-head">
          <h1>Carrito</h1>
        </div>
        <div className="empty">
          <p>Tu carrito está vacío.</p>
          <Link className="button" to="/">
            Ver el catálogo
          </Link>
        </div>
      </section>
    )

  return (
    <div className="split">
      <section className="module">
        <div className="module-head">
          <h1>Carrito</h1>
          <span className="meta">Lista de materiales</span>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Ref.</th>
                <th>Producto</th>
                <th className="n">Precio unitario</th>
                <th>Cantidad</th>
                <th className="n">Subtotal</th>
                <th>
                  <span className="sr-only">Quitar</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {lines.map((l) => (
                <tr key={l.productId}>
                  <td>
                    <Ref value={refs.get(l.productId)} />
                  </td>
                  <td>
                    <Link className="name" to={`/productos/${l.productId}`}>
                      {l.product.name}
                    </Link>
                    {l.quantity > l.product.stock && (
                      <span className="desc low">{l.product.stock === 0 ? "Se quedó sin stock: quitalo para seguir" : `Hay ${l.product.stock} en stock`}</span>
                    )}
                  </td>
                  <td className="n">{money(l.unit)}</td>
                  <td>
                    <QtyInput
                      value={l.quantity}
                      max={Math.max(l.product.stock, 1)}
                      label={`Cantidad de ${l.product.name}`}
                      onChange={(q) => setQuantity(l.productId, q)}
                    />
                  </td>
                  <td className="n price">{money(l.subtotal)}</td>
                  <td>
                    <button className="link danger" onClick={() => setQuantity(l.productId, 0)}>
                      Quitar
                    </button>
                  </td>
                </tr>
              ))}
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
            <dt>Productos</dt>
            <dd>{units}</dd>
            <dt className="grand">Total estimado</dt>
            <dd className="grand">{money(total)}</dd>
          </dl>
          <p className="muted small">El precio final y el stock se confirman al crear el pedido.</p>
          {overStock && <p className="error">Ajustá las cantidades marcadas: no alcanza el stock.</p>}
          {error && <p className="error">{error}</p>}
          <button onClick={checkout} disabled={!products || overStock}>
            {user ? "Confirmar pedido" : "Ingresá para comprar"}
          </button>
          <button className="secondary" onClick={() => confirm("¿Vaciar el carrito?") && clearCart()}>
            Vaciar carrito
          </button>
        </div>
      </aside>
    </div>
  )
}
