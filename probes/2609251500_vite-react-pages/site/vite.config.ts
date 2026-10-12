import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { codeInspectorPlugin } from 'code-inspector-plugin'
import { collabDevApi } from './collab/vite-plugin.ts'

export default defineConfig({
  plugins: [codeInspectorPlugin({ bundler: 'vite' }), react(), tailwindcss(), collabDevApi()],
  resolve: {
    alias: { '@collab': fileURLToPath(new URL('./collab', import.meta.url)) },
  },
})
