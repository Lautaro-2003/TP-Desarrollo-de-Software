import { Link, NavLink, Navigate, Route, Routes } from "react-router"
import { ReactNode } from "react"
import { useSession } from "./session"
import Catalog from "./pages/Catalog"
import ProductDetail from "./pages/ProductDetail"
import Cart from "./pages/Cart"
import { Login, Register } from "./pages/Auth"
import { MyOrders, OrderDetail } from "./pages/Orders"
import Admin from "./pages/Admin"

// protege una vista: sin sesión manda al login; con rol equivocado, al catálogo
function Private({ children, admin = false }: { children: ReactNode; admin?: boolean }) {
  const { user, loading } = useSession()
  if (loading) return <p className="muted">Cargando…</p>
  if (!user) return <Navigate to="/login" replace />
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

export default function App() {
  const { user, logout, cart } = useSession()
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
              <>
                <span className="who">
                  {user.name}
                  {user.role === "admin" && " (administrador)"}
                </span>
                <button className="link" onClick={logout}>
                  Salir
                </button>
              </>
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
        <nav className="bar2" aria-label="Secciones">
          <NavLink to="/" end>
            Catálogo
          </NavLink>
          {user?.role !== "admin" && <NavLink to="/carrito">Carrito</NavLink>}
          {user &&<NavLink to="/pedidos">{user.role === "admin" ? "Pedidos" : "Mis pedidos"}</NavLink>}
          {user?.role === "admin" && <NavLink to="/admin">Administración</NavLink>}
        </nav>
      </header>
      <main>
        <Routes>
          <Route path="/" element={<Catalog />} />
          <Route path="/productos/:id" element={<ProductDetail />} />
          <Route path="/carrito" element={<Cart />} />
          <Route path="/login" element={<Login />} />
          <Route path="/registro" element={<Register />} />
          <Route path="/pedidos" element={<Private><MyOrders /></Private>} />
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
