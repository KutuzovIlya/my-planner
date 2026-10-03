import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Идентификатор сборки: зашивается в код и кладётся в version.json,
// чтобы открытое приложение замечало новую версию на сервере.
const buildId = Date.now().toString(36)

// base: './' — чтобы сборка работала и на GitHub Pages (/repo/), и на своём домене
export default defineConfig({
  base: './',
  define: { __BUILD_ID__: JSON.stringify(buildId) },
  plugins: [
    react(),
    {
      name: 'version-json',
      generateBundle() {
        this.emitFile({ type: 'asset', fileName: 'version.json', source: JSON.stringify({ id: buildId }) })
      },
    },
  ],
})
