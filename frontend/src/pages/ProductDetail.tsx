import { FormEvent, useEffect, useState } from "react"
import { Link, useParams } from "react-router"
import { api, ApiError, Discount, Product, Review, date } from "../api"
import { useSession } from "../session"
import { Price, Stars } from "./Catalog"

export default function ProductDetail() {
  const { id } = useParams()
  const { user, addToCart } = useSession()
  const [product, setProduct] = useState<Product | null>(null)
  const [reviews, setReviews] = useState<Review[]>([])
  const [discounts, setDiscounts] = useState<Discount[]>([])
  const [rating, setRating] = useState(5)
  const [comment, setComment] = useState("")
  const [error, setError] = useState("")

  // recarga producto (para el promedio) y reseñas después de cada cambio
  const load = () => {
    api<Product>("GET", `/products/${id}`).then(setProduct).catch(() => setProduct(null))
    api<Review[]>("GET", `/reviews?productId=${id}`).then(setReviews)
  }
  useEffect(load, [id])
  useEffect(() => {
    api<Discount[]>("GET", "/discounts").then(setDiscounts)
  }, [])

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
    await api("DELETE", `/reviews/${reviewId}`)
    load()
  }

  if (!product) return <p className="muted">Cargando…</p>
  const alreadyReviewed = reviews.some((r) => r.userId === user?._id)

  return (
    <section className="narrow">
      <Link to="/">← Volver al catálogo</Link>
      <h1>{product.name}</h1>
      <p>{product.description}</p>
      <p>
        <Price product={product} discounts={discounts} /> · <Stars rating={product.rating} />
      </p>
      <p className="muted">{product.stock > 0 ? `Stock: ${product.stock}` : "Sin stock"}</p>
      {user?.role !== "admin" && (
        <button disabled={product.stock === 0} onClick={() => addToCart(product._id)}>
          Agregar al carrito
        </button>
      )}

      <h2>Reseñas</h2>
      {reviews.length === 0 && <p className="muted">Todavía no hay reseñas.</p>}
      <ul className="reviews">
        {reviews.map((r) => (
          <li key={r._id}>
            <span className="stars">{"★".repeat(r.rating) + "☆".repeat(5 - r.rating)}</span> <span className="muted small">{date(r.date)}</span>
            <p>{r.comment}</p>
            {(r.userId === user?._id || user?.role === "admin") && (
              <button className="link" onClick={() => remove(r._id)}>
                Eliminar
              </button>
            )}
          </li>
        ))}
      </ul>

      {user?.role === "cliente" && !alreadyReviewed && (
        <form onSubmit={submit} className="form">
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
          <button type="submit">Publicar reseña</button>
        </form>
      )}
      {!user && (
        <p className="muted">
          <Link to="/login">Ingresá</Link> para dejar una reseña de un producto que compraste.
        </p>
      )}
    </section>
  )
}
