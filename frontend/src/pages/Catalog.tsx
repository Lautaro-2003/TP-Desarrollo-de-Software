import { useEffect, useState } from "react"
import { Link } from "react-router"
import { api, Category, Discount, Product, discountFor, money, withDiscount } from "../api"
import { useSession } from "../session"

export function Stars({ rating }: { rating?: Product["rating"] }) {
  if (!rating) return <span className="muted">Sin reseñas</span>
  return (
    <span className="stars" title={`${rating.average} de 5`}>
      {"★".repeat(Math.round(rating.average)) + "☆".repeat(5 - Math.round(rating.average))}{" "}
      <span className="muted">({rating.count})</span>
    </span>
  )
}

export function Price({ product, discounts }: { product: Product; discounts: Discount[] }) {
  const pct = discountFor(discounts, product.categoryId)
  if (!pct) return <span className="price">{money(product.price)}</span>
  return (
    <span className="price">
      <s className="muted">{money(product.price)}</s> {money(withDiscount(product.price, pct))} <span className="badge">-{pct}%</span>
    </span>
  )
}

export default function Catalog() {
  const { user, addToCart } = useSession()
  // null = todavía cargando (para no mostrar "no hay productos" antes de tiempo)
  const [products, setProducts] = useState<Product[] | null>(null)
  const [categories, setCategories] = useState<Category[]>([])
  const [discounts, setDiscounts] = useState<Discount[]>([])
  const [categoryId, setCategoryId] = useState("")
  const [added, setAdded] = useState("")

  useEffect(() => {
    api<Category[]>("GET", "/categories").then(setCategories)
    api<Discount[]>("GET", "/discounts").then(setDiscounts)
  }, [])

  useEffect(() => {
    setProducts(null)
    api<Product[]>("GET", categoryId ? `/products?categoryId=${categoryId}` : "/products").then(setProducts)
  }, [categoryId])

  const categoryName = (id: string) => categories.find((c) => c._id === id)?.name ?? ""

  return (
    <section>
      <h1>Catálogo</h1>
      <div className="chips">
        <button className={categoryId === "" ? "chip active" : "chip"} onClick={() => setCategoryId("")}>
          Todas
        </button>
        {categories.map((c) => (
          <button key={c._id} className={categoryId === c._id ? "chip active" : "chip"} onClick={() => setCategoryId(c._id)}>
            {c.name}
          </button>
        ))}
      </div>

      {products === null && <p className="muted">Cargando…</p>}
      {products?.length === 0 && <p className="muted">No hay productos en esta categoría.</p>}
      <div className="grid">
        {products?.map((p) => (
          <article key={p._id} className="card">
            <span className="muted small">{categoryName(p.categoryId)}</span>
            <h2>
              <Link to={`/productos/${p._id}`}>{p.name}</Link>
            </h2>
            <p className="muted">{p.description}</p>
            <Stars rating={p.rating} />
            <Price product={p} discounts={discounts} />
            <span className="small muted">{p.stock > 0 ? `Stock: ${p.stock}` : "Sin stock"}</span>
            {user?.role !== "admin" && (
              <button
                disabled={p.stock === 0}
                onClick={() => {
                  addToCart(p._id)
                  setAdded(p._id)
                }}
              >
                {added === p._id ? "Agregado ✓" : "Agregar al carrito"}
              </button>
            )}
          </article>
        ))}
      </div>
    </section>
  )
}
