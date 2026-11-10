// nombre legible para la URL: 'Monitor 27" 144 Hz' → "monitor-27-144-hz"
export function slugify(text: string, fallback = "producto"): string {
  const slug = text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
  return slug || fallback
}
