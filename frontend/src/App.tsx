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

export default function App() {
  const { user, logout, cart } = useSession()
  const items = cart.reduce((sum, i) => sum + i.quantity, 0)

  return (
    <>
      <header className="topbar">
        <Link to="/" className="brand">
          Tienda de Informática
        </Link>
        <nav>
          <NavLink to="/" end>
            Catálogo
          </NavLink>
          {user?.role !== "admin" && <NavLink to="/carrito">Carrito{items > 0 && ` (${items})`}</NavLink>}
          {user && <NavLink to="/pedidos">{user.role === "admin" ? "Pedidos" : "Mis pedidos"}</NavLink>}
          {user?.role === "admin" && <NavLink to="/admin">Administración</NavLink>}
          {user ? (
            <span className="user">
              {user.name}
              <button className="link" onClick={logout}>
                Salir
              </button>
            </span>
          ) : (
            <NavLink to="/login">Ingresar</NavLink>
          )}
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
          <Route path="*" element={<p>Página no encontrada. <Link to="/">Volver al catálogo</Link></p>} />
        </Routes>
      </main>
    </>
  )
}
