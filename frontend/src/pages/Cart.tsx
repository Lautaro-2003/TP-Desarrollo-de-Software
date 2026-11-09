import { useEffect, useState } from "react"
import { Link, useNavigate } from "react-router"
import { api, ApiError, Category, Discount, Order, Product, designators, discountFor, money, withDiscount } from "../api"
import { useSession } from "../session"
import { Ref } from "./Catalog"

export default function Cart() {
  const { user, cart, setQuantity, clearCart } = useSession()
  const navigate = useNavigate()
  const [products, setProducts] = useState<Product[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [discounts, setDiscounts] = useState<Discount[]>([])
  const [error, setError] = useState("")

  useEffect(() => {
    api<Product[]>("GET", "/products").then(setProducts)
    api<Category[]>("GET", "/categories").then(setCategories)
    api<Discount[]>("GET", "/discounts").then(setDiscounts)
  }, [])

  const refs = designators(products, categories)
  const lines = cart
    .map((item) => ({ ...item, product: products.find((p) => p._id === item.productId) }))
    .filter((line) => line.product)
    .map((line) => {
      const unit = withDiscount(line.product!.price, discountFor(discounts, line.product!.categoryId))
      return { ...line, unit, subtotal: unit * line.quantity }
    })
  const total = lines.reduce((sum, l) => sum + l.subtotal, 0)
  const units = lines.reduce((sum, l) => sum + l.quantity, 0)

  // el servidor valida stock y calcula el precio definitivo; acá solo se muestra una estimación
  async function checkout() {
    setError("")
    if (!user) return navigate("/login")
    try {
      const data = await api<{ order: Order }>("POST", "/orders/checkout", {
        items: cart.map(({ productId, quantity }) => ({ productId, quantity })),
      })
      clearCart()
      navigate(`/pedidos/${data.order._id}`)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No se pudo crear el pedido")
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
                      {l.product!.name}
                    </Link>
                    {l.quantity > l.product!.stock && <span className="desc low">Hay {l.product!.stock} en stock</span>}
                  </td>
                  <td className="n">{money(l.unit)}</td>
                  <td>
                    <input
                      type="number"
                      min={0}
                      max={l.product!.stock}
                      value={l.quantity}
                      onChange={(e) => setQuantity(l.productId, Math.min(Number(e.target.value), l.product!.stock))}
                      aria-label={`Cantidad de ${l.product!.name}`}
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
          {error && <p className="error">{error}</p>}
          <button onClick={checkout}>{user ? "Confirmar pedido" : "Ingresá para comprar"}</button>
          <button className="secondary" onClick={clearCart}>
            Vaciar carrito
          </button>
        </div>
      </aside>
    </div>
  )
}
