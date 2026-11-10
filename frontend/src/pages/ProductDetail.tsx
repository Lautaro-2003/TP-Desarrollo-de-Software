import { FormEvent, useEffect, useState } from "react"
import { Link, useParams } from "react-router"
import { api, ApiError, Category, Discount, Order, Product, Review, date, designators } from "../api"
import { useSession } from "../session"
import { Price, StarRow, Stars, Stock } from "./Catalog"

export default function ProductDetail() {
  const { id } = useParams()
  const { user, cart, addToCart } = useSession()
  const [product, setProduct] = useState<Product | null>(null)
  const [missing, setMissing] = useState(false)
  const [siblings, setSiblings] = useState<Product[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [reviews, setReviews] = useState<Review[]>([])
  const [discounts, setDiscounts] = useState<Discount[]>([])
  const [rating, setRating] = useState(5)
  const [comment, setComment] = useState("")
  const [error, setError] = useState("")
  const [added, setAdded] = useState(false)

  // recarga producto (para el promedio) y reseñas después de cada cambio
  const load = () => {
    api<Product>("GET", `/products/${id}`)
      .then(setProduct)
      .catch(() => setMissing(true))
    api<Review[]>("GET", `/reviews?productId=${id}`).then(setReviews)
  }
  useEffect(load, [id])
  useEffect(() => {
    api<Discount[]>("GET", "/discounts").then(setDiscounts)
    api<Category[]>("GET", "/categories").then(setCategories)
  }, [])
  // los productos de la misma categoría dan el número del designador
  useEffect(() => {
    if (product) api<Product[]>("GET", `/products?categoryId=${product.categoryId}`).then(setSiblings)
  }, [product?.categoryId])
  // mismo criterio que el backend: reseña quien tiene un pedido ya pagado con este producto
  const [bought, setBought] = useState(false)
  useEffect(() => {
    setBought(false)
    if (user?.role !== "cliente") return
    api<Order[]>("GET", "/orders")
      .then((orders) => Promise.all(orders.filter((o) => o.status !== "pendiente").map((o) => api<Order>("GET", `/orders/${o._id}`))))
      .then((details) => setBought(details.some((o) => o.items?.some((i) => i.productId === id))))
  }, [user, id])

  async function submit(e: FormEvent) {
    e.preventDefault()
    setError("")
    try {
      await api("POST", "/reviews", { productId: id, rating, comment })
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
  const inCart = cart.find((i) => i.productId === product._id)?.quantity ?? 0

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

      <div className="detail">
        <section className="module identity">
          <div className="footprint">
            <div className="courtyard">
              <span className="sr-only">Designador</span>
              <b>{ref ?? "…"}</b>
            </div>
          </div>
          <div className="module-body">
            <h1 className="page-title">{product.name}</h1>
            <p className="lead">{product.description}</p>
            <Stars rating={product.rating} />
          </div>
        </section>

        <aside className="module buy">
          <div className="module-head">
            <h2>Comprar</h2>
          </div>
          <div className="module-body">
            <Price product={product} discounts={discounts} />
            <p className="small">
              <Stock stock={product.stock} />
            </p>
            {user?.role === "admin" ? (
              <p className="muted small">Los administradores no compran desde la tienda.</p>
            ) : (
              <>
                <button
                  disabled={inCart >= product.stock}
                  onClick={() => {
                    addToCart(product._id, product.stock)
                    setAdded(true)
                  }}
                >
                  {product.stock === 0 ? "Sin stock" : inCart >= product.stock ? "Ya tenés todo el stock en el carrito" : "Agregar al carrito"}
                </button>
                {added && (
                  <p className="small" role="status">
                    Agregado. <Link to="/carrito">Ver carrito</Link>
                  </p>
                )}
              </>
            )}
          </div>
        </aside>

        <section className="module reviews-module">
          <div className="module-head">
            <h2>Reseñas</h2>
            <span className="meta">Solo de quienes compraron este producto</span>
          </div>
          {reviews.length === 0 && <p className="empty">Todavía no hay reseñas.</p>}
          <ul className="review-list">
            {reviews.map((r) => (
              <li key={r._id}>
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
          {error && !(user?.role === "cliente" && bought && !alreadyReviewed) && <p className="error">{error}</p>}
          {user?.role === "cliente" && !bought && <p className="empty">Vas a poder reseñar este producto cuando lo compres y pagues.</p>}
          {user?.role === "cliente" && bought && !alreadyReviewed && (
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
              <Link to="/login" state={{ from: `/productos/${id}` }}>
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
