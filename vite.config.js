import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    // scripts/prerender.mjs reads the manifest to preload the product page chunk.
    manifest: true,
  },
})
