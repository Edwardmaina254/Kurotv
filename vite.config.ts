import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  preview: {
    // This allows Railway's domain to access the Vite preview server
    allowedHosts: true,
    // Alternatively, you can use the specific domain:
    // allowedHosts: ['kurotv-production.up.railway.app']
  }
})