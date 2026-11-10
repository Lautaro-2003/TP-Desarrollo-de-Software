import { FormEvent, useEffect, useRef, useState } from "react"
import { Link, Navigate, useLocation, useParams } from "react-router"
import { api, ApiError } from "../api"
import { useSession } from "../session"

// a dónde volver al ingresar: la página que mandó al login (ej. el carrito) o el catálogo
function useReturnTo() {
  return (useLocation().state as { from?: string } | null)?.from ?? "/"
}

export function Login() {
  const { user, login } = useSession()
  const from = useReturnTo()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState("")

  async function submit(e: FormEvent) {
    e.preventDefault()
    setError("")
    try {
      await login(email, password)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No se pudo iniciar sesión")
    }
  }

  // con sesión iniciada (o recién iniciada) no tiene sentido el formulario
  if (user) return <Navigate to={from} replace />

  return (
    <section className="module auth">
      <div className="module-head">
        <h1>Ingresar</h1>
      </div>
      <form onSubmit={submit} className="form module-body">
        <label>
          Email
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" />
        </label>
        <label>
          Contraseña
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required autoComplete="current-password" />
        </label>
        {error && <p className="error">{error}</p>}
        <button type="submit">Ingresar</button>
        <p className="muted">
          ¿No tenés cuenta?{" "}
          <Link to="/registro" state={{ from }}>
            Creá una
          </Link>
        </p>
      </form>
    </section>
  )
}

export function Register() {
  const { user } = useSession()
  const from = useReturnTo()
  const [form, setForm] = useState({ name: "", email: "", address: "", password: "" })
  const [error, setError] = useState("")
  const [sent, setSent] = useState(false)
  const field = (key: keyof typeof form) => ({
    value: form[key],
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, [key]: e.target.value }),
    required: true,
  })

  async function submit(e: FormEvent) {
    e.preventDefault()
    setError("")
    try {
      // ya no entra solo: primero tiene que confirmar el email con el link del mail
      await api("POST", "/auth/register", form)
      setSent(true)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No se pudo crear la cuenta")
    }
  }

  if (user) return <Navigate to={from} replace />

  if (sent)
    return (
      <section className="module auth">
        <div className="module-head">
          <h1>Revisá tu email</h1>
        </div>
        <div className="form module-body">
          <p className="notice" role="status">
            Te mandamos un mail a <strong>{form.email}</strong> para confirmar la cuenta. Abrí el link y después ingresá.
          </p>
          <p className="muted">
            ¿No te llegó? Al intentar ingresar te lo reenviamos.{" "}
            <Link to="/login" state={{ from }}>
              Ir a Ingresar
            </Link>
          </p>
        </div>
      </section>
    )

  return (
    <section className="module auth">
      <div className="module-head">
        <h1>Crear cuenta</h1>
      </div>
      <form onSubmit={submit} className="form module-body">
        <label>
          Nombre
          <input {...field("name")} autoComplete="name" />
        </label>
        <label>
          Email
          <input type="email" {...field("email")} autoComplete="email" />
        </label>
        <label>
          Dirección de envío
          <input {...field("address")} autoComplete="street-address" />
        </label>
        <label>
          Contraseña (mínimo 8 caracteres)
          <input type="password" minLength={8} {...field("password")} autoComplete="new-password" />
        </label>
        {error && <p className="error">{error}</p>}
        <button type="submit">Crear cuenta</button>
        <p className="muted">
          ¿Ya tenés cuenta?{" "}
          <Link to="/login" state={{ from }}>
            Ingresá
          </Link>
        </p>
      </form>
    </section>
  )
}

// destino del link del mail de confirmación: /confirmar/:token
export function ConfirmEmail() {
  const { token } = useParams()
  const [state, setState] = useState<{ ok: boolean; message: string } | null>(null)
  const sent = useRef("")

  useEffect(() => {
    // el token sirve una sola vez: StrictMode corre el efecto dos veces y el segundo pedido daría 404
    if (sent.current === token) return
    sent.current = token!
    api("GET", `/auth/confirm/${token}`).then(
      () => setState({ ok: true, message: "Tu email quedó confirmado: ya podés ingresar." }),
      (err) => setState({ ok: false, message: err instanceof ApiError ? err.message : "No se pudo confirmar el email" })
    )
  }, [token])

  return (
    <section className="module auth">
      <div className="module-head">
        <h1>Confirmar email</h1>
      </div>
      <div className="form module-body">
        {!state && <p className="muted">Confirmando…</p>}
        {state && (
          <p className={state.ok ? "notice" : "error"} role="status">
            {state.message}
          </p>
        )}
        {state && <Link to="/login">Ir a Ingresar</Link>}
      </div>
    </section>
  )
}
