import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig(({ mode }) => {
  const configuredBase = loadEnv(mode, '.', '').VITE_BASE_PATH ?? '/truss'
  const normalizedBase = configuredBase.replace(/^\/+|\/+$/g, '')

  return {
    base: normalizedBase ? `/${normalizedBase}/` : '/',
    plugins: [react()],
    server: {
      port: 3300,
      allowedHosts: ['dev.lambda8.at'],
    },
    preview: {
      port: 3300,
    },
  }
})
