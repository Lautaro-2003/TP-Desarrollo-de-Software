// fotos del demo: imágenes de Unsplash (licencia libre, sin atribución obligatoria) servidas desde su CDN a 800px.
// Todas son tomas sobre fondo claro, para que la grilla tenga un mismo piso. Procedencia: el id de cada foto
// (photo-<id> en images.unsplash.com) queda escrito en las seeds, junto al producto que ilustra
export const unsplash = (id: string) => `https://images.unsplash.com/photo-${id}?w=800&q=80&auto=format&fit=crop`
