// shortcut: los importes son números de JS redondeados al centavo; pasar a centavos enteros si se agrega un medio de pago real
export function roundCents(amount: number): number {
  return Math.round(amount * 100) / 100
}
