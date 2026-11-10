import { Link, NavLink, Navigate, Route, Routes, useLocation, useNavigate, useSearchParams } from "react-router"
import { FormEvent, ReactNode, useEffect, useRef, useState } from "react"
import { useSession } from "./session"
import { api, Category, Discount, categoryPath, discountFor, prefixFor } from "./api"
import { Icon } from "./ui"
import Catalog from "./pages/Catalog"
import ProductDetail from "./pages/ProductDetail"
import Cart from "./pages/Cart"
import { ConfirmEmail, Login, Register } from "./pages/Auth"
import { MyOrders, OrderDetail } from "./pages/Orders"
import Account from "./pages/Account"
import Admin from "./pages/Admin"

// protege una vista: sin sesión manda al login (y vuelve acá al ingresar); con rol equivocado, al catálogo
function Private({ children, admin = false }: { children: ReactNode; admin?: boolean }) {
  const { user, loading } = useSession()
  const { pathname } = useLocation()
  if (loading) return <p className="muted">Cargando…</p>
  if (!user) return <Navigate to="/login" replace state={{ from: pathname }} />
  if (admin && user.role !== "admin") return <Navigate to="/" replace />
  return children
}

// marca: un chip visto desde arriba, cuerpo serigrafiado y patas doradas
function ChipMark() {
  const pins = [8, 15, 22]
  return (
    <svg viewBox="0 0 30 30" aria-hidden="true">
      {pins.map((p) => (
        <g key={p} fill="#c9a43a">
          <rect x={p - 1.5} y="1" width="3" height="5" />
          <rect x={p - 1.5} y="24" width="3" height="5" />
          <rect x="1" y={p - 1.5} width="5" height="3" />
          <rect x="24" y={p - 1.5} width="5" height="3" />
        </g>
      ))}
      <rect x="6.5" y="6.5" width="17" height="17" rx="1" fill="none" stroke="#f4f4ee" strokeWidth="1.8" />
      <circle cx="10.5" cy="10.5" r="1.6" fill="#f4f4ee" />
    </svg>
  )
}

// el nombre del usuario abre su menú: cuenta (con sus pedidos), las vistas del admin y salir
function UserMenu() {
  const { user, logout } = useSession()
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const [open, setOpen] = useState(false)
  const box = useRef<HTMLDivElement>(null)
  const toggle = useRef<HTMLButtonElement>(null)

  useEffect(() => setOpen(false), [pathname])
  // se cierra con un clic afuera o con Escape (que devuelve el foco al botón)
  useEffect(() => {
    if (!open) return
    const onClick = (e: MouseEvent) => !box.current?.contains(e.target as Node) && setOpen(false)
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return
      setOpen(false)
      toggle.current?.focus()
    }
    document.addEventListener("mousedown", onClick)
    document.addEventListener("keydown", onKey)
    return () => {
      document.removeEventListener("mousedown", onClick)
      document.removeEventListener("keydown", onKey)
    }
  }, [open])

  if (!user) return null
  return (
    <div className="user-menu" ref={box}>
      <button ref={toggle} className="who" aria-expanded={open} aria-controls="menu-cuenta" onClick={() => setOpen(!open)}>
        {user.name}
        {user.role === "admin" && " (administrador)"}
        <svg viewBox="0 0 10 10" aria-hidden="true">
          <path d="M1.5 3.5l3.5 3.5 3.5-3.5" fill="none" stroke="currentColor" strokeWidth="1.5" />
        </svg>
      </button>
      {open && (
        <ul id="menu-cuenta">
          <li>
            <Link to="/cuenta">{user.role === "admin" ? "Mi cuenta" : "Mi cuenta y pedidos"}</Link>
          </li>
          {user.role === "admin" && (
            <>
              <li>
                <Link to="/pedidos">Pedidos</Link>
              </li>
              <li>
                <Link to="/admin">Administración</Link>
              </li>
            </>
          )}
          <li>
            <button
              onClick={() => {
                logout()
                navigate("/")
              }}
            >
              Salir
            </button>
          </li>
        </ul>
      )}
    </div>
  )
}

// el buscador vive en el header: en el catálogo filtra mientras se escribe; desde otra página lleva al catálogo
function SearchBox() {
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const [params, setParams] = useSearchParams()
  const onCatalog = pathname === "/"
  const [text, setText] = useState(onCatalog ? (params.get("q") ?? "") : "")

  // si la búsqueda cambia desde afuera (ej. "Ver todo el catálogo"), el campo la acompaña
  useEffect(() => {
    if (onCatalog) setText(params.get("q") ?? "")
  }, [onCatalog, params.get("q")])

  function change(value: string) {
    setText(value)
    if (!onCatalog) return
    const next = new URLSearchParams(params)
    if (value.trim()) next.set("q", value)
    else next.delete("q")
    setParams(next, { replace: true })
  }

  function submit(e: FormEvent) {
    e.preventDefault()
    if (!onCatalog) navigate(text.trim() ? `/?q=${encodeURIComponent(text.trim())}` : "/")
  }

  return (
    <form className="search" role="search" onSubmit={submit}>
      <label className="sr-only" htmlFor="buscar">
        Buscar productos
      </label>
      <input id="buscar" type="search" value={text} onChange={(e) => change(e.target.value)} placeholder="Buscá placas, monitores, periféricos…" />
      <button type="submit" aria-label="Buscar">
        <Icon name="search" />
      </button>
    </form>
  )
}

// barra de categorías: cada una con su prefijo de designador y, si tiene descuento vigente, el porcentaje
function CategoryBar() {
  const { pathname } = useLocation()
  const [params] = useSearchParams()
  const [categories, setCategories] = useState<Category[]>([])
  const [discounts, setDiscounts] = useState<Discount[]>([])
  useEffect(() => {
    api<Category[]>("GET", "/categories").then(setCategories)
    api<Discount[]>("GET", "/discounts").then(setDiscounts)
  }, [])

  const active = pathname === "/" ? (params.get("categoria") ?? "") : null
  // en pantallas angostas la barra se desplaza sola hasta la categoría activa (solo en horizontal, sin mover la página)
  const bar = useRef<HTMLElement>(null)
  useEffect(() => {
    const el = bar.current?.querySelector<HTMLElement>('[aria-current="page"]')
    if (!bar.current || !el) return
    const { left, right } = el.getBoundingClientRect()
    const box = bar.current.getBoundingClientRect()
    if (left < box.left || right > box.right) bar.current.scrollLeft += left - box.left - 16
  }, [active, categories, discounts])
  return (
    <nav className="catbar" aria-label="Categorías" ref={bar}>
      <Link to="/" aria-current={active === "" ? "page" : undefined}>
        Todo
      </Link>
      {categories.map((c) => {
        const pct = discountFor(discounts, c._id)
        return (
          <Link key={c._id} to={categoryPath(c)} aria-current={active === c.slug || active === c._id ? "page" : undefined}>
            <span className="prefix">{prefixFor(c.name)}</span>
            {c.name}
            {pct > 0 && <span className="off">-{pct}%</span>}
          </Link>
        )
      })}
    </nav>
  )
}

export default function App() {
  const { user, cart } = useSession()
  const items = cart.reduce((sum, i) => sum + i.quantity, 0)

  return (
    <>
      <header>
        <div className="bar1">
          <Link to="/" className="brand" aria-label="Tienda de Informática, ir al catálogo">
            <ChipMark />
            <span className="wordmark" aria-hidden="true">
              <small>Tienda de</small>
              <b>Informática</b>
            </span>
          </Link>
          <SearchBox />
          <div className="account">
            {user ? (
              <UserMenu />
            ) : (
              <>
                <NavLink to="/login">Ingresar</NavLink>
                <NavLink to="/registro">Crear cuenta</NavLink>
              </>
            )}
            {user?.role !== "admin" && (
              <NavLink to="/carrito" className="cart-chip" aria-label={`Carrito, ${items} ${items === 1 ? "producto" : "productos"}`}>
                <Icon name="cart" />
                Carrito <span className="pad-count">{items}</span>
              </NavLink>
            )}
          </div>
        </div>
        <CategoryBar />
      </header>
      <main>
        <Routes>
          <Route path="/" element={<Catalog />} />
          <Route path="/productos/:slug" element={<ProductDetail />} />
          <Route path="/carrito" element={<Cart />} />
          <Route path="/login" element={<Login />} />
          <Route path="/registro" element={<Register />} />
          <Route path="/confirmar/:token" element={<ConfirmEmail />} />
          <Route path="/cuenta" element={<Private><Account /></Private>} />
          {/* los pedidos del cliente viven en su cuenta; /pedidos queda para el listado completo del admin */}
          <Route
            path="/pedidos"
            element={user?.role === "cliente" ? <Navigate to="/cuenta" replace /> : <Private admin><MyOrders /></Private>}
          />
          <Route path="/pedidos/:id" element={<Private><OrderDetail /></Private>} />
          <Route path="/admin" element={<Private admin><Admin /></Private>} />
          <Route
            path="*"
            element={
              <section className="module">
                <div className="empty">
                  <p>Esta página no existe.</p>
                  <Link to="/">Volver al catálogo</Link>
                </div>
              </section>
            }
          />
        </Routes>
      </main>
    </>
  )
}
