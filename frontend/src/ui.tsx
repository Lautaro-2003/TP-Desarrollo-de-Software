import { useState } from "react"
import { Product } from "./api"
import { useSession } from "./session"

// íconos de trazo propio, todos en la misma grilla de 20px y el mismo grosor
const PATHS = {
  search: "M8.5 14.5a6 6 0 1 1 0-12 6 6 0 0 1 0 12zM13 13l4.5 4.5",
  cart: "M2 3h2.2l2 9.5h9.3l1.8-6.5H5.3M8 17a1 1 0 1 0 0-.01M15 17a1 1 0 1 0 0-.01",
  minus: "M5 10h10",
  plus: "M5 10h10M10 5v10",
  trash: "M4 6h12M8 6V4h4v2M6 6l.8 10h6.4L14 6",
  check: "M4.5 10.5l3.5 3.5 7.5-8",
}

export function Icon({ name }: { name: keyof typeof PATHS }) {
  return (
    <svg className="icon" viewBox="0 0 20 20" aria-hidden="true">
      <path d={PATHS[name]} fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

// quitar un producto del carrito siempre se confirma, venga de donde venga
export const confirmRemove = (name: string) => confirm(`¿Quitar ${name} del carrito?`)

// cantidad con − y +: el − en 1 quita el producto (con confirmación) y el + se frena en el stock
export function Stepper({ value, max, name, onChange }: { value: number; max: number; name: string; onChange: (q: number) => void }) {
  return (
    <div className="stepper" role="group" aria-label={`Cantidad de ${name}`}>
      <button
        type="button"
        aria-label={value === 1 ? `Quitar ${name} del carrito` : "Uno menos"}
        onClick={() => (value === 1 ? confirmRemove(name) && onChange(0) : onChange(value - 1))}
      >
        <Icon name={value === 1 ? "trash" : "minus"} />
      </button>
      <output aria-live="polite">{value}</output>
      <button type="button" aria-label="Uno más" disabled={value >= max} onClick={() => onChange(value + 1)}>
        <Icon name="plus" />
      </button>
    </div>
  )
}

// el botón de compra de un producto: "Agregar" y, una vez en el carrito, la cantidad editable ahí mismo
export function CartControl({ product, label = "Agregar" }: { product: Product; label?: string }) {
  const { cart, addToCart, setQuantity } = useSession()
  const qty = cart.find((i) => i.productId === product._id)?.quantity ?? 0

  if (qty > 0)
    return (
      <div className="in-cart">
        <Stepper value={qty} max={product.stock} name={product.name} onChange={(q) => setQuantity(product._id, q)} />
        <span className="small">{qty >= product.stock ? "Todo el stock" : "En el carrito"}</span>
      </div>
    )
  return (
    <button className="add" disabled={product.stock === 0} onClick={() => addToCart(product._id, product.stock)}>
      {product.stock === 0 ? (
        "Sin stock"
      ) : (
        <>
          <Icon name="cart" />
          {label}
        </>
      )}
    </button>
  )
}

// huella serigrafiada: ocupa el lugar de la foto cuando el producto no tiene o no carga
export function Footprint({ label }: { label?: string }) {
  return (
    <div className="footprint">
      <div className="courtyard">
        <span className="sr-only">Sin foto. Designador</span>
        <b>{label ?? "…"}</b>
      </div>
    </div>
  )
}

// foto del producto con el designador serigrafiado encima; el descuento va junto al precio, no acá
export function ProductImage({ product, refLabel, alt = "" }: { product: Product; refLabel?: string; alt?: string }) {
  const [failed, setFailed] = useState("")
  const showPhoto = product.image && failed !== product.image

  return (
    <div className="media">
      {showPhoto ? <img src={product.image} alt={alt} loading="lazy" onError={() => setFailed(product.image!)} /> : <Footprint label={refLabel} />}
      {showPhoto && refLabel && <span className="ref">{refLabel}</span>}
    </div>
  )
}

// miniatura para tablas (carrito, pedido, admin): foto chica o el prefijo sobre verde
export function Thumb({ product }: { product?: Product }) {
  const [failed, setFailed] = useState(false)
  if (!product?.image || failed) return <span className="thumb empty" aria-hidden="true" />
  return <img className="thumb" src={product.image} alt="" loading="lazy" onError={() => setFailed(true)} />
}
