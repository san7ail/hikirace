import { cloudflare } from '@cloudflare/vite-plugin'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

export default defineConfig({
  // The Worker serves the built assets and the lobby API from one origin, so
  // `npm run dev` gives real websockets instead of a static-only preview.
  plugins: [react(), cloudflare()],
})
