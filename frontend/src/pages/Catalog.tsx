import { useEffect, useRef, useState } from "react"
import { Link, useSearchParams } from "react-router"
import { api, Category, Discount, Product, date, designators, discountFor, money, productPath, withDiscount } from "../api"
import { useSession } from "../session"
import { CartControl, Icon, ProductImage, Stepper, confirmRemove } from "../ui"

const STAR = "M8 1.3l2 4.3 4.7.6-3.4 3.3.9 4.6L8 11.9l-4.2 2.2.9-4.6L1.3 6.2 6 5.6z"

export function StarRow({ value }: { value: number }) {
  return (
    <span className="star-row" aria-hidden="true">
      {[1, 2, 3, 4, 5].map((n) => (
        <svg key={n} viewBox="0 0 16 16" className={n <= Math.round(value) ? "on" : undefined}>
          <path d={STAR} />
        </svg>
      ))}
    </span>
  )
}

export function Stars({ rating }: { rating?: Product["rating"] }) {
  if (!rating) return <span className="muted small">Sin reseñas</span>
  const average = rating.average.toLocaleString("es-AR", { maximumFractionDigits: 1 })
  return (
    <span className="stars" aria-label={`${average} de 5, ${rating.count} ${rating.count === 1 ? "reseña" : "reseñas"}`}>
      <StarRow value={rating.average} />
      <span className="muted small" aria-hidden="true">
        {average} ({rating.count})
      </span>
    </span>
  )
}

export function Price({ product, discounts }: { product: Product; discounts: Discount[] }) {
  const pct = discountFor(discounts, product.categoryId)
  if (!pct) return <span className="price">{money(product.price)}</span>
  return (
    <span className="price">
      <s>{money(product.price)}</s>
      {money(withDiscount(product.price, pct))}
      <span className="off">-{pct}%</span>
    </span>
  )
}

export function Ref({ value }: { value?: string }) {
  return value ? <span className="ref">{value}</span> : null
}

export function Stock({ stock }: { stock: number }) {
  if (stock === 0) return <span className="out">Sin stock</span>
  if (stock <= 5) return <span className="low">Quedan {stock}</span>
  return (
    <span className="in">
      <Icon name="check" />
      Stock disponible
    </span>
  )
}

// "Ordenar por": cada opción es un criterio y un sentido; el empate se desempata por designador
const SORTS = {
  ref: { label: "Categoría", key: "ref", dir: 1 },
  "price-asc": { label: "Menor precio", key: "price", dir: 1 },
  "price-desc": { label: "Mayor precio", key: "price", dir: -1 },
  rating: { label: "Mejor calificados", key: "rating", dir: -1 },
  stock: { label: "Más stock", key: "stock", dir: -1 },
  name: { label: "Nombre (A-Z)", key: "name", dir: 1 },
} as const
type SortId = keyof typeof SORTS

export default function Catalog() {
  const { user, cart, setQuantity } = useSession()
  const [params, setParams] = useSearchParams()
  const categoryId = params.get("categoria") ?? ""
  const query = params.get("q") ?? ""
  // null = todavía cargando (para no mostrar "no hay productos" antes de tiempo)
  const [products, setProducts] = useState<Product[] | null>(null)
  const [categories, setCategories] = useState<Category[]>([])
  const [discounts, setDiscounts] = useState<Discount[]>([])
  const [sortId, setSortId] = useState<SortId>("ref")
  const sort = SORTS[sortId]

  // el renglón del carrito que acaba de cambiar destella en dorado
  const [touched, setTouched] = useState("")
  const lastCart = useRef(cart)
  useEffect(() => {
    const changed = cart.find((i) => lastCart.current.find((o) => o.productId === i.productId)?.quantity !== i.quantity)
    if (changed) setTouched(`${changed.productId}-${changed.quantity}`)
    lastCart.current = cart
  }, [cart])

  useEffect(() => {
    api<Category[]>("GET", "/categories").then(setCategories)
    api<Discount[]>("GET", "/discounts").then(setDiscounts)
    // se trae todo una vez: el filtro, la búsqueda y el orden son locales
    api<Product[]>("GET", "/products").then(setProducts)
  }, [])

  const refs = designators(products ?? [], categories)
  const categoryName = (id: string) => categories.find((c) => c._id === id)?.name ?? ""
  const finalPrice = (p: Product) => withDiscount(p.price, discountFor(discounts, p.categoryId))
  const sortValue = {
    ref: (p: Product) => refs.get(p._id) ?? "",
    name: (p: Product) => p.name.toLowerCase(),
    rating: (p: Product) => p.rating?.average ?? -1,
    stock: (p: Product) => p.stock,
    price: finalPrice,
  }
  const q = query.trim().toLowerCase()
  const byRef = (a: Product, b: Product) => (refs.get(a._id) ?? "").localeCompare(refs.get(b._id) ?? "", "es", { numeric: true })
  const visible = (products ?? [])
    .filter((p) => !categoryId || p.categoryId === categoryId)
    .filter((p) => !q || `${p.name} ${p.description}`.toLowerCase().includes(q))
    .sort((a, b) => {
      const [x, y] = [sortValue[sort.key](a), sortValue[sort.key](b)]
      return (x < y ? -1 : x > y ? 1 : 0) * sort.dir || byRef(a, b)
    })

  const lines = cart.flatMap((item) => {
    const p = products?.find((x) => x._id === item.productId)
    return p ? [{ ...item, product: p, unit: finalPrice(p), subtotal: finalPrice(p) * item.quantity }] : []
  })
  const now = new Date()
  const activeDiscounts = discounts.filter((d) => new Date(d.startDate) <= now && now < new Date(d.endDate))
  const title = categoryId ? categoryName(categoryId) : q ? "Resultados de la búsqueda" : "Todo el catálogo"
  const buyer = user?.role !== "admin"

  return (
    <div className="shop">
      <section className="shop-main" aria-labelledby="catalogo-titulo">
        <div className="shop-head">
          <div>
            <h1 id="catalogo-titulo">{title}</h1>
            <p className="muted">
              {products === null
                ? "Cargando…"
                : `${visible.length} ${visible.length === 1 ? "producto" : "productos"}${q ? ` para “${query.trim()}”` : ""}`}
            </p>
          </div>
          <label className="sort">
            Ordenar por
            <select value={sortId} onChange={(e) => setSortId(e.target.value as SortId)}>
              {Object.entries(SORTS).map(([id, s]) => (
                <option key={id} value={id}>
                  {s.label}
                </option>
              ))}
            </select>
          </label>
        </div>

        {products !== null && visible.length === 0 && (
          <div className="module empty">
            <p>{q ? `Ningún producto coincide con “${query.trim()}”.` : "Todavía no hay productos en esta categoría."}</p>
            <button className="secondary small" onClick={() => setParams({})}>
              Ver todo el catálogo
            </button>
          </div>
        )}

        <ul className="grid">
          {visible.map((p) => (
            <li key={p._id} className="card">
              <ProductImage product={p} refLabel={refs.get(p._id)} />
              <div className="card-body">
                <h2>
                  {/* el enlace del nombre cubre toda la tarjeta; el botón de compra queda por encima */}
                  <Link to={productPath(p)}>{p.name}</Link>
                </h2>
                <Stars rating={p.rating} />
                <span className="card-stock small">
                  <Stock stock={p.stock} />
                </span>
                <Price product={p} discounts={discounts} />
                {buyer && <CartControl product={p} />}
              </div>
            </li>
          ))}
        </ul>
      </section>

      <aside className="side">
        {buyer && (
          <section className="module">
            <div className="module-head">
              <h2>Tu carrito</h2>
              {lines.length > 0 && <span className="meta">Lista de materiales</span>}
            </div>
            {lines.length === 0 ? (
              <p className="empty">Vacío. Agregá productos desde la grilla y el total se arma acá.</p>
            ) : (
              <>
                <ul className="bom" aria-live="polite">
                  {lines.map((l) => (
                    <li key={l.productId} className={touched === `${l.productId}-${l.quantity}` ? "flash" : undefined}>
                      <Ref value={refs.get(l.productId)} />
                      <Link className="what" to={productPath(l.product)}>
                        {l.product.name}
                      </Link>
                      <span className="sub">{money(l.subtotal)}</span>
                      <Stepper value={l.quantity} max={l.product.stock} name={l.product.name} onChange={(n) => setQuantity(l.productId, n)} />
                      <span className="qty">× {money(l.unit)}</span>
                      <button className="link danger" onClick={() => confirmRemove(l.product.name) && setQuantity(l.productId, 0)}>
                        Quitar
                      </button>
                    </li>
                  ))}
                </ul>
                <div className="bom-total">
                  <span>Total</span>
                  <span>{money(lines.reduce((sum, l) => sum + l.subtotal, 0))}</span>
                </div>
                <div className="bom-cta">
                  <Link className="button" to="/carrito">
                    Revisar y confirmar
                  </Link>
                </div>
              </>
            )}
          </section>
        )}
        {activeDiscounts.length > 0 && (
          <section className="module">
            <div className="module-head">
              <h2>Descuentos vigentes</h2>
            </div>
            <ul className="deals">
              {activeDiscounts.map((d) => (
                <li key={d._id}>
                  <Link to={`/?categoria=${d.categoryId}`}>{categoryName(d.categoryId)}</Link>
                  <span>
                    <span className="off">-{d.percentage}%</span> <span className="muted small">hasta el {date(d.endDate)}</span>
                  </span>
                </li>
              ))}
            </ul>
          </section>
        )}
      </aside>
    </div>
  )
}
