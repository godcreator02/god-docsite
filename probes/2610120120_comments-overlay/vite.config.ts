import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  plugins: [react()],
  server: { port: 5480, host: '127.0.0.1', strictPort: true },
  preview: { port: 5480, host: '127.0.0.1', strictPort: true },
  build: { outDir: 'dist' },
  test: { environment: 'jsdom' },
})
