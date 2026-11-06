import { FormEvent, useState } from "react"
import { Link, useNavigate } from "react-router"
import { api, ApiError } from "../api"
import { useSession } from "../session"

export function Login() {
  const { login } = useSession()
  const navigate = useNavigate()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState("")

  async function submit(e: FormEvent) {
    e.preventDefault()
    setError("")
    try {
      await login(email, password)
      navigate("/")
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No se pudo iniciar sesión")
    }
  }

  return (
    <form onSubmit={submit} className="form narrow">
      <h1>Ingresar</h1>
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
        ¿No tenés cuenta? <Link to="/registro">Registrate</Link>
      </p>
    </form>
  )
}

export function Register() {
  const { login } = useSession()
  const navigate = useNavigate()
  const [form, setForm] = useState({ name: "", email: "", address: "", password: "" })
  const [error, setError] = useState("")
  const field = (key: keyof typeof form) => ({
    value: form[key],
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, [key]: e.target.value }),
    required: true,
  })

  async function submit(e: FormEvent) {
    e.preventDefault()
    setError("")
    try {
      await api("POST", "/auth/register", form)
      await login(form.email, form.password)
      navigate("/")
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No se pudo crear la cuenta")
    }
  }

  return (
    <form onSubmit={submit} className="form narrow">
      <h1>Crear cuenta</h1>
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
    </form>
  )
}
