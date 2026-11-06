import { FormEvent, useEffect, useState } from "react"
import { api, ApiError, Category } from "../api"

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

  const show = (f: Field, value: unknown) =>
    f.type === "category" ? (categories.find((c) => c._id === value)?.name ?? "—") : f.type === "date" ? String(value).slice(0, 10) : String(value ?? "")

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
    setError("")
    try {
      await api("DELETE", `${path}/${id}`)
      load()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No se pudo eliminar")
    }
  }

  return (
    <div>
      <table>
        <thead>
          <tr>
            {fields.map((f) => (
              <th key={f.key}>{f.label}</th>
            ))}
            <th></th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row._id}>
              {fields.map((f) => (
                <td key={f.key}>{show(f, row[f.key])}</td>
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

      <form onSubmit={submit} className="form inline">
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
                required
              />
            )}
          </label>
        ))}
        {error && <p className="error">{error}</p>}
        <div>
          <button type="submit">{editing ? "Guardar cambios" : "Crear"}</button>{" "}
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
    <section>
      <h1>Administración</h1>
      <p className="muted">Los pedidos se gestionan desde la sección Pedidos.</p>
      <div className="chips" role="tablist">
        {SECTIONS.map((s, i) => (
          <button key={s.path} role="tab" aria-selected={tab === i} className={tab === i ? "chip active" : "chip"} onClick={() => setTab(i)}>
            {s.title}
          </button>
        ))}
      </div>
      <CrudSection key={SECTIONS[tab].path} {...SECTIONS[tab]} categories={categories} />
    </section>
  )
}
