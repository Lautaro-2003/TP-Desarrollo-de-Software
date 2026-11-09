import { useEffect, useState } from "react"
import { Link, useSearchParams } from "react-router"
import { api, Category, Discount, Product, date, designators, discountFor, money, prefixFor, withDiscount } from "../api"
import { useSession } from "../session"

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
    <span>
      {stock}
      <span className="unit"> en stock</span>
    </span>
  )
}

type SortKey = "ref" | "name" | "rating" | "stock" | "price"

function SortIcon({ dir }: { dir: number }) {
  return (
    <svg viewBox="0 0 10 10" aria-hidden="true">
      <path d={dir === 1 ? "M1 7l4-4 4 4" : dir === -1 ? "M1 3l4 4 4-4" : "M2 4l3-3 3 3M2 6l3 3 3-3"} fill="none" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  )
}

export default function Catalog() {
  const { user, cart, addToCart } = useSession()
  const inCart = (id: string) => cart.find((i) => i.productId === id)?.quantity ?? 0
  const [params, setParams] = useSearchParams()
  const categoryId = params.get("categoria") ?? ""
  // null = todavía cargando (para no mostrar "no hay productos" antes de tiempo)
  const [products, setProducts] = useState<Product[] | null>(null)
  const [categories, setCategories] = useState<Category[]>([])
  const [discounts, setDiscounts] = useState<Discount[]>([])
  const [query, setQuery] = useState("")
  const [sort, setSort] = useState<{ key: SortKey; dir: number }>({ key: "ref", dir: 1 })
  const [added, setAdded] = useState("")

  useEffect(() => {
    api<Category[]>("GET", "/categories").then(setCategories)
    api<Discount[]>("GET", "/discounts").then(setDiscounts)
    // se trae todo una vez: el filtro, la búsqueda y el orden son locales y los contadores del riel salen de acá
    api<Product[]>("GET", "/products").then(setProducts)
  }, [])

  const refs = designators(products ?? [], categories)
  const categoryName = (id: string) => categories.find((c) => c._id === id)?.name ?? ""
  const finalPrice = (p: Product) => withDiscount(p.price, discountFor(discounts, p.categoryId))
  const sortValue: Record<SortKey, (p: Product) => string | number> = {
    ref: (p) => refs.get(p._id) ?? "",
    name: (p) => p.name.toLowerCase(),
    rating: (p) => p.rating?.average ?? -1,
    stock: (p) => p.stock,
    price: finalPrice,
  }
  const q = query.trim().toLowerCase()
  const visible = (products ?? [])
    .filter((p) => !categoryId || p.categoryId === categoryId)
    .filter((p) => !q || `${p.name} ${p.description}`.toLowerCase().includes(q))
    .sort((a, b) => {
      const [x, y] = [sortValue[sort.key](a), sortValue[sort.key](b)]
      return (x < y ? -1 : x > y ? 1 : 0) * sort.dir || (refs.get(a._id) ?? "").localeCompare(refs.get(b._id) ?? "", "es", { numeric: true })
    })

  const chooseCategory = (id: string) => setParams(id ? { categoria: id } : {})

  // se llama como función (no como componente) para que el botón conserve el foco al reordenar
  const sortTh = (k: SortKey, label: string, num = false) => {
    const active = sort.key === k
    return (
      <th className={num ? "n" : undefined} aria-sort={active ? (sort.dir === 1 ? "ascending" : "descending") : "none"}>
        <button className="sort" onClick={() => setSort({ key: k, dir: active ? -sort.dir : 1 })}>
          {label}
          <SortIcon dir={active ? sort.dir : 0} />
        </button>
      </th>
    )
  }

  const lines = cart.flatMap((item) => {
    const p = products?.find((x) => x._id === item.productId)
    return p ? [{ ...item, product: p, subtotal: finalPrice(p) * item.quantity }] : []
  })
  const now = new Date()
  const activeDiscounts = discounts.filter((d) => new Date(d.startDate) <= now && now < new Date(d.endDate))
  const count = (id: string) => (products ?? []).filter((p) => p.categoryId === id).length
  const title = categoryId ? categoryName(categoryId) : "Todo el catálogo"

  return (
    <div className="board">
      <aside className="rail">
        <section className="module">
          <div className="module-head">
            <h2>Categorías</h2>
          </div>
          <ul className="catlist">
            <li>
              <button aria-pressed={categoryId === ""} onClick={() => chooseCategory("")}>
                <span className="prefix">ALL</span>Todas<span className="count">{products?.length ?? ""}</span>
              </button>
            </li>
            {categories.map((c) => (
              <li key={c._id}>
                <button aria-pressed={categoryId === c._id} onClick={() => chooseCategory(c._id)}>
                  <span className="prefix">{prefixFor(c.name)}</span>
                  {c.name}
                  <span className="count">{products ? count(c._id) : ""}</span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      </aside>

      <section className="module main">
        <div className="module-head">
          <h1>{title}</h1>
          <span className="meta">
            {products === null ? "Cargando…" : `${visible.length} ${visible.length === 1 ? "producto" : "productos"}`}
          </span>
        </div>
        <div className="toolbar">
          <label>
            Buscar
            <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Modelo o descripción" />
          </label>
        </div>

        {products !== null && visible.length === 0 && (
          <div className="empty">
            <p>{q ? `Ningún producto coincide con “${query.trim()}”.` : "Todavía no hay productos en esta categoría."}</p>
            {(q || categoryId) && (
              <button
                className="secondary small"
                onClick={() => {
                  setQuery("")
                  chooseCategory("")
                }}
              >
                Ver todo el catálogo
              </button>
            )}
          </div>
        )}

        {visible.length > 0 && (
          <div className="table-wrap">
            <table className="products">
              <thead>
                <tr>
                  {sortTh("ref", "Ref.")}
                  {sortTh("name", "Producto")}
                  {sortTh("rating", "Reseñas")}
                  {sortTh("stock", "Stock", true)}
                  {sortTh("price", "Precio", true)}
                  {user?.role !== "admin" && (
                    <th>
                      <span className="sr-only">Agregar</span>
                    </th>
                  )}
                </tr>
              </thead>
              <tbody>
                {visible.map((p) => (
                  <tr key={p._id}>
                    <td className="c-ref">
                      <Ref value={refs.get(p._id)} />
                    </td>
                    <td className="c-name">
                      <Link className="name" to={`/productos/${p._id}`}>
                        {p.name}
                      </Link>
                      <span className="desc" title={p.description}>
                        {p.description}
                      </span>
                    </td>
                    <td className="c-rating">
                      <Stars rating={p.rating} />
                    </td>
                    <td className="n c-stock">
                      <Stock stock={p.stock} />
                    </td>
                    <td className="n c-price">
                      <Price product={p} discounts={discounts} />
                    </td>
                    {user?.role !== "admin" && (
                      <td className="c-add">
                        <button
                          className="small"
                          disabled={inCart(p._id) >= p.stock}
                          aria-label={`Agregar ${p.name} al carrito`}
                          onClick={() => {
                            addToCart(p._id, p.stock)
                            setAdded(p._id)
                          }}
                        >
                          {p.stock === 0 ? "Sin stock" : inCart(p._id) >= p.stock ? "Máximo" : "Agregar"}
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <aside className="side">
        {user?.role !== "admin" && (
          <section className="module">
            <div className="module-head">
              <h2>Tu carrito</h2>
              {lines.length > 0 && <span className="meta">Lista de materiales</span>}
            </div>
            {lines.length === 0 ? (
              <p className="empty">Vacío. Agregá productos desde la tabla y el total se arma acá.</p>
            ) : (
              <>
                <ul className="bom" aria-live="polite">
                  {lines.map((l) => (
                    <li key={`${l.productId}-${l.quantity}`} className={l.productId === added ? "flash" : undefined}>
                      <Ref value={refs.get(l.productId)} />
                      <span className="what">{l.product.name}</span>
                      <span className="sub">{money(l.subtotal)}</span>
                      <span className="qty">
                        {l.quantity} × {money(finalPrice(l.product))}
                      </span>
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
                  <button className="link" onClick={() => chooseCategory(d.categoryId)}>
                    {categoryName(d.categoryId)}
                  </button>
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
