import { Link, NavLink, Navigate, Route, Routes, useLocation, useNavigate } from "react-router"
import { ReactNode, useEffect, useRef, useState } from "react"
import { useSession } from "./session"
import Catalog from "./pages/Catalog"
import ProductDetail from "./pages/ProductDetail"
import Cart from "./pages/Cart"
import { Login, Register } from "./pages/Auth"
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

export default function App() {
  const { user, cart } = useSession()
  const items = cart.reduce((sum, i) => sum + i.quantity, 0)

  return (
    <>
      <header>
        <div className="bar1">
          <Link to="/" className="brand">
            <ChipMark />
            Tienda de Informática
          </Link>
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
              <NavLink to="/carrito" className="cart-chip">
                Carrito <span className="pad-count">{items}</span>
              </NavLink>
            )}
          </div>
        </div>
      </header>
      <main>
        <Routes>
          <Route path="/" element={<Catalog />} />
          <Route path="/productos/:id" element={<ProductDetail />} />
          <Route path="/carrito" element={<Cart />} />
          <Route path="/login" element={<Login />} />
          <Route path="/registro" element={<Register />} />
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
