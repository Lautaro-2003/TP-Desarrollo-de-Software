import { useEffect, useState } from "react"
import { Link, useNavigate } from "react-router"
import { api, ApiError, Discount, Order, Product, discountFor, money, withDiscount } from "../api"
import { useSession } from "../session"

export default function Cart() {
  const { user, cart, setQuantity, clearCart } = useSession()
  const navigate = useNavigate()
  const [products, setProducts] = useState<Product[]>([])
  const [discounts, setDiscounts] = useState<Discount[]>([])
  const [error, setError] = useState("")

  useEffect(() => {
    api<Product[]>("GET", "/products").then(setProducts)
    api<Discount[]>("GET", "/discounts").then(setDiscounts)
  }, [])

  const lines = cart
    .map((item) => ({ ...item, product: products.find((p) => p._id === item.productId) }))
    .filter((line) => line.product)
    .map((line) => {
      const unit = withDiscount(line.product!.price, discountFor(discounts, line.product!.categoryId))
      return { ...line, unit, subtotal: unit * line.quantity }
    })
  const total = lines.reduce((sum, l) => sum + l.subtotal, 0)

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
      <section>
        <h1>Carrito</h1>
        <p className="muted">
          Tu carrito está vacío. <Link to="/">Ver el catálogo</Link>
        </p>
      </section>
    )

  return (
    <section className="narrow">
      <h1>Carrito</h1>
      <table>
        <thead>
          <tr>
            <th>Producto</th>
            <th>Precio</th>
            <th>Cantidad</th>
            <th>Subtotal</th>
          </tr>
        </thead>
        <tbody>
          {lines.map((l) => (
            <tr key={l.productId}>
              <td>{l.product!.name}</td>
              <td>{money(l.unit)}</td>
              <td>
                <input
                  type="number"
                  min={0}
                  max={l.product!.stock}
                  value={l.quantity}
                  onChange={(e) => setQuantity(l.productId, Number(e.target.value))}
                  aria-label={`Cantidad de ${l.product!.name}`}
                />
              </td>
              <td>{money(l.subtotal)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="total">Total estimado: {money(total)}</p>
      {error && <p className="error">{error}</p>}
      <button onClick={checkout}>{user ? "Confirmar pedido" : "Ingresá para comprar"}</button>{" "}
      <button className="secondary" onClick={clearCart}>
        Vaciar carrito
      </button>
    </section>
  )
}
