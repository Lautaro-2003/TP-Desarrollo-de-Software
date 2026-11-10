import { FormEvent, useEffect, useState } from "react"
import { Link, useNavigate, useParams } from "react-router"
import { api, ApiError, Category, Discount, Order, Product, Review, date, designators, productPath } from "../api"
import { useSession } from "../session"
import { CartControl, Icon, ProductImage } from "../ui"
import { Price, StarRow, Stars, Stock } from "./Catalog"

export default function ProductDetail() {
  // la URL trae el slug (o el id en enlaces viejos: el backend acepta los dos)
  const { slug } = useParams()
  const navigate = useNavigate()
  const { user, cart } = useSession()
  const [product, setProduct] = useState<Product | null>(null)
  const [missing, setMissing] = useState(false)
  const [siblings, setSiblings] = useState<Product[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [reviews, setReviews] = useState<Review[]>([])
  const [discounts, setDiscounts] = useState<Discount[]>([])
  const [rating, setRating] = useState(5)
  const [comment, setComment] = useState("")
  const [error, setError] = useState("")
  const [bought, setBought] = useState(false)

  // recarga producto (para el promedio) y reseñas después de cada cambio
  const load = () =>
    api<Product>("GET", `/products/${slug}`)
      .then((p) => {
        setProduct(p)
        // un enlace viejo con el id pasa a la URL legible sin dejar el id en el historial
        if (p.slug && p.slug !== slug) navigate(productPath(p), { replace: true })
        // la más reciente primero, como en la lista de pedidos
        return api<Review[]>("GET", `/reviews?productId=${p._id}`).then((list) => setReviews([...list].sort((a, b) => b.date.localeCompare(a.date))))
      })
      .catch(() => setMissing(true))
  useEffect(() => {
    setMissing(false)
    load()
  }, [slug])
  useEffect(() => {
    api<Discount[]>("GET", "/discounts").then(setDiscounts)
    api<Category[]>("GET", "/categories").then(setCategories)
  }, [])
  // los productos de la misma categoría dan el número del designador
  useEffect(() => {
    if (product) api<Product[]>("GET", `/products?categoryId=${product.categoryId}`).then(setSiblings)
  }, [product?.categoryId])
  // mismo criterio que el backend: reseña quien tiene un pedido ya pagado con este producto
  useEffect(() => {
    setBought(false)
    if (user?.role !== "cliente" || !product) return
    api<Order[]>("GET", "/orders")
      .then((orders) => Promise.all(orders.filter((o) => o.status !== "pendiente").map((o) => api<Order>("GET", `/orders/${o._id}`))))
      .then((details) => setBought(details.some((o) => o.items?.some((i) => i.productId === product._id))))
  }, [user, product?._id])

  async function submit(e: FormEvent) {
    e.preventDefault()
    setError("")
    try {
      await api("POST", "/reviews", { productId: product!._id, rating, comment })
      setComment("")
      load()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No se pudo guardar la reseña")
    }
  }

  async function remove(reviewId: string) {
    if (!confirm("¿Eliminar esta reseña? No se puede deshacer.")) return
    setError("")
    try {
      await api("DELETE", `/reviews/${reviewId}`)
      load()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No se pudo eliminar la reseña")
    }
  }

  if (missing)
    return (
      <section className="module">
        <div className="empty">
          <p>Este producto no existe o se dio de baja.</p>
          <Link to="/">Volver al catálogo</Link>
        </div>
      </section>
    )
  if (!product) return <p className="muted">Cargando…</p>

  const category = categories.find((c) => c._id === product.categoryId)
  const ref = designators(siblings, categories).get(product._id)
  const alreadyReviewed = reviews.some((r) => r.userId === user?._id)
  const inCart = cart.some((i) => i.productId === product._id)
  const formShown = user?.role === "cliente" && bought && !alreadyReviewed

  return (
    <>
      <nav className="crumbs" aria-label="Ubicación">
        <ol>
          <li>
            <Link to="/">Catálogo</Link>
          </li>
          {category && (
            <li>
              <Link to={`/?categoria=${category._id}`}>{category.name}</Link>
            </li>
          )}
          <li aria-current="page">{product.name}</li>
        </ol>
      </nav>

      <div className="pdp">
        <figure className="module pdp-media">
          <ProductImage product={product} refLabel={ref} alt={product.name} />
          {product.image && <figcaption className="muted small">Foto ilustrativa</figcaption>}
        </figure>

        <section className="module pdp-buy" aria-labelledby="producto-nombre">
          <div className="module-body">
            <h1 id="producto-nombre" className="page-title">
              {product.name}
            </h1>
            <Stars rating={product.rating} />
            <p className="lead">{product.description}</p>
            <div className="price-box">
              <Price product={product} discounts={discounts} />
              <p className="small">
                <Stock stock={product.stock} />
                {product.stock > 5 && <span className="muted"> · {product.stock} unidades</span>}
              </p>
            </div>
            {user?.role === "admin" ? (
              <p className="muted small">Los administradores no compran desde la tienda.</p>
            ) : (
              <>
                <CartControl product={product} label="Agregar al carrito" />
                {inCart && (
                  <Link className="button secondary" to="/carrito">
                    Ver carrito
                  </Link>
                )}
              </>
            )}
            <ul className="facts small">
              <li>El stock se reserva al pagar el pedido.</li>
              <li>Las reseñas son solo de quienes lo compraron.</li>
            </ul>
          </div>
        </section>

        <section className="module reviews-module">
          <div className="module-head">
            <h2>Reseñas</h2>
            <span className="meta">Solo de quienes compraron este producto</span>
          </div>
          {reviews.length === 0 && <p className="empty">Todavía no hay reseñas.</p>}
          <ul className="review-list">
            {reviews.map((r) => (
              <li key={r._id}>
                {/* toda reseña es de una compra: la API no deja reseñar sin un pedido pagado */}
                <p className="review-by">
                  <b>{r.author}</b>
                  <span className="in">
                    <Icon name="check" />
                    Compra verificada
                  </span>
                </p>
                <div className="stars">
                  <span className="sr-only">{r.rating} de 5</span>
                  <StarRow value={r.rating} />
                  <span className="muted small">{date(r.date)}</span>
                </div>
                <p>{r.comment}</p>
                {(r.userId === user?._id || user?.role === "admin") && (
                  <button className="link danger small" onClick={() => remove(r._id)}>
                    Eliminar reseña
                  </button>
                )}
              </li>
            ))}
          </ul>

          {/* el error del formulario queda adentro; acá se muestra el de borrar una reseña */}
          {error && !formShown && <p className="error">{error}</p>}
          {user?.role === "cliente" && !bought && <p className="empty">Vas a poder reseñar este producto cuando lo compres y pagues.</p>}
          {formShown && (
            <form onSubmit={submit} className="form review-form">
              <h3>Dejá tu reseña</h3>
              <label>
                Calificación
                <select value={rating} onChange={(e) => setRating(Number(e.target.value))}>
                  {[5, 4, 3, 2, 1].map((n) => (
                    <option key={n} value={n}>
                      {n} {n === 1 ? "estrella" : "estrellas"}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Comentario
                <textarea value={comment} onChange={(e) => setComment(e.target.value)} required maxLength={1000} />
              </label>
              {error && <p className="error">{error}</p>}
              <div className="row">
                <button type="submit">Publicar reseña</button>
              </div>
            </form>
          )}
          {!user && (
            <p className="empty">
              <Link to="/login" state={{ from: productPath(product) }}>
                Ingresá
              </Link>{" "}
              para dejar una reseña de un producto que compraste.
            </p>
          )}
        </section>
      </div>
    </>
  )
}
