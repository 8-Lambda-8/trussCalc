import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  base: '/truss/',
  plugins: [react()],
  server: {
    port: 3300,
    allowedHosts: ["dev.lambda8.at"],
  },
  preview: {
    port: 3300,
  },
})
