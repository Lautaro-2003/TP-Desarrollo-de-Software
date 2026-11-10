import { Link } from "react-router"
import { useSession } from "../session"
import { MyOrders } from "./Orders"

// página del usuario: sus datos y, si es cliente, sus pedidos para seguirlos, pagarlos o cancelarlos
export default function Account() {
  const user = useSession().user!

  return (
    <>
      <section className="module contained">
        <div className="module-head">
          <h1>Mi cuenta</h1>
          {user.role === "admin" && <span className="meta">Administrador</span>}
        </div>
        <div className="module-body">
          <dl className="profile">
            <dt>Nombre</dt>
            <dd>{user.name}</dd>
            <dt>Email</dt>
            <dd>{user.email}</dd>
            <dt>Dirección de envío</dt>
            <dd>{user.address}</dd>
          </dl>
          {user.role === "admin" && (
            <p className="muted">
              Los pedidos de los clientes se gestionan desde <Link to="/pedidos">Pedidos</Link> y el catálogo desde{" "}
              <Link to="/admin">Administración</Link>.
            </p>
          )}
        </div>
      </section>
      {user.role === "cliente" && <MyOrders />}
    </>
  )
}
