import { FormEvent, useState } from "react"
import { Link } from "react-router"
import { api, ApiError, User } from "../api"
import { useSession } from "../session"
import { MyOrders } from "./Orders"

// página del usuario: sus datos (editables) y, si es cliente, sus pedidos para seguirlos, pagarlos o cancelarlos
export default function Account() {
  const { user: sessionUser, setUser } = useSession()
  const user = sessionUser!
  const [editing, setEditing] = useState(false)
  const [name, setName] = useState(user.name)
  const [address, setAddress] = useState(user.address)
  const [error, setError] = useState("")
  const [saving, setSaving] = useState(false)

  const startEditing = () => {
    setName(user.name)
    setAddress(user.address)
    setError("")
    setEditing(true)
  }

  // el backend valida y recorta los campos; la sesión se actualiza con lo que devuelve
  async function submit(e: FormEvent) {
    e.preventDefault()
    setSaving(true)
    try {
      setUser(await api<User>("PATCH", `/users/${user._id}`, { name, address }))
      setEditing(false)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No se pudieron guardar los cambios")
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <section className="module contained">
        <div className="module-head">
          <h1>Mi cuenta</h1>
          {user.role === "admin" && <span className="meta">Administrador</span>}
        </div>
        <div className="module-body">
          {editing ? (
            <form onSubmit={submit} className="form">
              <label>
                Nombre
                <input value={name} onChange={(e) => setName(e.target.value)} required maxLength={120} autoComplete="name" />
              </label>
              <label>
                Dirección de envío
                <input
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  required
                  maxLength={200}
                  autoComplete="street-address"
                />
              </label>
              {error && <p className="error">{error}</p>}
              <div className="row">
                <button type="submit" disabled={saving}>
                  {saving ? "Guardando…" : "Guardar cambios"}
                </button>
                <button type="button" className="secondary" onClick={() => setEditing(false)}>
                  Cancelar
                </button>
              </div>
            </form>
          ) : (
            <>
              <dl className="profile">
                <dt>Nombre</dt>
                <dd>{user.name}</dd>
                <dt>Email</dt>
                <dd>{user.email}</dd>
                <dt>Dirección de envío</dt>
                <dd>{user.address}</dd>
              </dl>
              <div className="actions">
                <button className="secondary" onClick={startEditing}>
                  Editar mis datos
                </button>
              </div>
            </>
          )}
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
