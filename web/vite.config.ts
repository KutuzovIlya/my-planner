import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// base: './' — чтобы сборка работала и на GitHub Pages (/repo/), и на своём домене
export default defineConfig({
  base: './',
  plugins: [react()],
})
