import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  // Relative asset URLs keep the build host-agnostic (works from any subpath).
  base: './',
  plugins: [react()],
})
