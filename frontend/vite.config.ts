import { defineConfig } from "vite"
import react from "@vitejs/plugin-react"

// en desarrollo, /api se redirige al backend: front y API quedan en el mismo origen y no hace falta CORS
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: { "/api": "http://localhost:3000" },
  },
})
