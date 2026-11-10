import { FormEvent, useEffect, useState } from "react"
import { Link } from "react-router"
import { api, ApiError, Category, Product, designators, money } from "../api"
import { Ref } from "./Catalog"

// descripción de un campo del formulario de alta/modificación
type Field = { key: string; label: string; type: "text" | "number" | "date" | "category" }

const SECTIONS: { title: string; singular: string; path: string; fields: Field[] }[] = [
  {
    title: "Productos",
    singular: "producto",
    path: "/products",
    fields: [
      { key: "name", label: "Nombre", type: "text" },
      { key: "description", label: "Descripción", type: "text" },
      { key: "price", label: "Precio", type: "number" },
      { key: "stock", label: "Stock", type: "number" },
      { key: "status", label: "Estado", type: "text" },
      { key: "categoryId", label: "Categoría", type: "category" },
    ],
  },
  {
    title: "Categorías",
    singular: "categoría",
    path: "/categories",
    fields: [
      { key: "name", label: "Nombre", type: "text" },
      { key: "description", label: "Descripción", type: "text" },
    ],
  },
  {
    title: "Descuentos",
    singular: "descuento",
    path: "/discounts",
    fields: [
      { key: "categoryId", label: "Categoría", type: "category" },
      { key: "percentage", label: "Porcentaje", type: "number" },
      { key: "startDate", label: "Desde", type: "date" },
      { key: "endDate", label: "Hasta (exclusivo)", type: "date" },
    ],
  },
]

type Row = Record<string, unknown> & { _id: string }

// un mismo componente sirve para los tres ABM: lista, alta, modificación y baja contra la API
function CrudSection({ singular, path, fields, categories }: (typeof SECTIONS)[number] & { categories: Category[] }) {
  const [rows, setRows] = useState<Row[]>([])
  const [editing, setEditing] = useState<string | null>(null)
  const [form, setForm] = useState<Record<string, string>>({})
  const [error, setError] = useState("")

  const load = () => api<Row[]>("GET", path).then(setRows)
  useEffect(() => {
    load()
  }, [path])

  // mismo formato que la tienda: precios en pesos, fechas dd/mm/aaaa (sin pasar por zona horaria) y estados con mayúscula
  const show = (f: Field, value: unknown) => {
    if (f.type === "category") return categories.find((c) => c._id === value)?.name ?? "—"
    if (f.type === "date") return String(value).slice(0, 10).split("-").reverse().join("/")
    if (f.key === "price") return money(Number(value))
    if (f.key === "percentage") return `${value}%`
    const text = String(value ?? "")
    return f.key === "status" ? text.charAt(0).toUpperCase() + text.slice(1) : text
  }
  const refs = path === "/products" ? designators(rows as unknown as Product[], categories) : null
  const statuses = [...new Set(rows.map((r) => String(r.status ?? "")).filter(Boolean))]

  function edit(row: Row) {
    setEditing(row._id)
    setForm(Object.fromEntries(fields.map((f) => [f.key, f.type === "date" ? String(row[f.key]).slice(0, 10) : String(row[f.key] ?? "")])))
  }

  function reset() {
    setEditing(null)
    setForm({})
    setError("")
  }

  async function submit(e: FormEvent) {
    e.preventDefault()
    setError("")
    // los números viajan como número; el resto como texto (las fechas en formato AAAA-MM-DD)
    const body = Object.fromEntries(fields.map((f) => [f.key, f.type === "number" ? Number(form[f.key]) : form[f.key]]))
    try {
      await api(editing ? "PATCH" : "POST", editing ? `${path}/${editing}` : path, body)
      reset()
      load()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No se pudo guardar")
    }
  }

  async function remove(id: string) {
    if (!confirm(`¿Eliminar ${singular === "categoría" ? "esta" : "este"} ${singular}? No se puede deshacer.`)) return
    setError("")
    try {
      await api("DELETE", `${path}/${id}`)
      load()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No se pudo eliminar")
    }
  }

  return (
    <div className="admin-grid">
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              {refs && <th>Ref.</th>}
              {fields.map((f) => (
                <th key={f.key} className={f.type === "number" ? "n" : undefined}>
                  {f.label}
                </th>
              ))}
              <th>
                <span className="sr-only">Acciones</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row._id}>
                {refs && (
                  <td>
                    <Ref value={refs.get(row._id)} />
                  </td>
                )}
                {fields.map((f) => (
                  <td key={f.key} className={f.type === "number" ? "n" : undefined}>
                    {show(f, row[f.key])}
                  </td>
                ))}
                <td className="actions">
                  <button className="link" onClick={() => edit(row)}>
                    Editar
                  </button>
                  <button className="link danger" onClick={() => remove(row._id)}>
                    Eliminar
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {rows.length === 0 && <p className="empty">Todavía no hay registros. Creá el primero con el formulario.</p>}
      </div>

      <form onSubmit={submit} className="form">
        <h3>{editing ? `Modificar ${singular}` : `Agregar ${singular}`}</h3>
        {fields.map((f) => (
          <label key={f.key}>
            {f.label}
            {f.type === "category" ? (
              <select value={form[f.key] ?? ""} onChange={(e) => setForm({ ...form, [f.key]: e.target.value })} required>
                <option value="">Elegí una categoría</option>
                {categories.map((c) => (
                  <option key={c._id} value={c._id}>
                    {c.name}
                  </option>
                ))}
              </select>
            ) : (
              <input
                type={f.type}
                step={f.type === "number" ? "any" : undefined}
                value={form[f.key] ?? ""}
                onChange={(e) => setForm({ ...form, [f.key]: e.target.value })}
                list={f.key === "status" ? "estados-producto" : undefined}
                required
              />
            )}
          </label>
        ))}
        {/* el backend acepta cualquier texto: se sugieren los estados que ya se usan */}
        {fields.some((f) => f.key === "status") && (
          <datalist id="estados-producto">
            {statuses.map((s) => (
              <option key={s} value={s} />
            ))}
          </datalist>
        )}
        {error && <p className="error">{error}</p>}
        <div className="row">
          <button type="submit">{editing ? "Guardar cambios" : `Crear ${singular}`}</button>
          {editing && (
            <button type="button" className="secondary" onClick={reset}>
              Cancelar
            </button>
          )}
        </div>
      </form>
    </div>
  )
}

export default function Admin() {
  const [tab, setTab] = useState(0)
  const [categories, setCategories] = useState<Category[]>([])

  // las categorías se recargan al cambiar de pestaña para que los selectores queden al día
  useEffect(() => {
    api<Category[]>("GET", "/categories").then(setCategories)
  }, [tab])

  return (
    <section className="module">
      <div className="module-head">
        <h1>Administración</h1>
        <span className="meta">
          Los pedidos se gestionan desde <Link to="/pedidos">Pedidos</Link>.
        </span>
      </div>
      <div className="tabs" role="tablist">
        {SECTIONS.map((s, i) => (
          <button key={s.path} role="tab" aria-selected={tab === i} onClick={() => setTab(i)}>
            {s.title}
          </button>
        ))}
      </div>
      <div role="tabpanel" aria-label={SECTIONS[tab].title}>
        <CrudSection key={SECTIONS[tab].path} {...SECTIONS[tab]} categories={categories} />
      </div>
    </section>
  )
}
