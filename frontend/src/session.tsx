import { createContext, useContext, useEffect, useState, ReactNode } from "react"
import { api, tokenStore, User } from "./api"

type CartItem = { productId: string; quantity: number }

type Session = {
  user: User | null
  loading: boolean
  login: (email: string, password: string) => Promise<void>
  logout: () => void
  cart: CartItem[]
  setQuantity: (productId: string, quantity: number) => void
  addToCart: (productId: string, stock: number) => void
  clearCart: () => void
}

const SessionContext = createContext<Session | null>(null)
const CART_KEY = "tienda.carrito"

function readCart(): CartItem[] {
  try {
    return JSON.parse(localStorage.getItem(CART_KEY) ?? "[]")
  } catch {
    return []
  }
}

// sesión del usuario (token en localStorage) y carrito del navegador
export function SessionProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(!!tokenStore.get())
  const [cart, setCart] = useState<CartItem[]>(readCart)

  // si hay un token guardado, se recupera el usuario; si venció, se descarta
  useEffect(() => {
    if (!tokenStore.get()) return
    api<User>("GET", "/auth/me")
      .then(setUser)
      .catch(() => tokenStore.clear())
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => localStorage.setItem(CART_KEY, JSON.stringify(cart)), [cart])

  const setQuantity = (productId: string, quantity: number) =>
    setCart((items) =>
      quantity <= 0
        ? items.filter((i) => i.productId !== productId)
        : items.some((i) => i.productId === productId)
          ? items.map((i) => (i.productId === productId ? { ...i, quantity } : i))
          : [...items, { productId, quantity }]
    )

  const value: Session = {
    user,
    loading,
    async login(email, password) {
      const data = await api<{ token: string; user: User }>("POST", "/auth/login", { email, password })
      tokenStore.set(data.token)
      setUser(data.user)
    },
    logout() {
      tokenStore.clear()
      setUser(null)
    },
    cart,
    setQuantity,
    addToCart: (productId, stock) =>
      setQuantity(productId, Math.min(stock, (cart.find((i) => i.productId === productId)?.quantity ?? 0) + 1)),
    clearCart: () => setCart([]),
  }
  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>
}

export function useSession() {
  const session = useContext(SessionContext)
  if (!session) throw new Error("useSession debe usarse dentro de SessionProvider")
  return session
}
