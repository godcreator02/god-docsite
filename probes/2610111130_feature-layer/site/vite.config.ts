import path from 'node:path'
import { reactRouter } from '@react-router/dev/vite'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vite'
import { fumadocsMdx } from 'fumadocs-mdx/vite'
import { docsite } from '@godcreator/docsite-kit/vite'

export default defineConfig({
  resolve: { alias: { '@site': path.resolve(import.meta.dirname, 'app') } },
  plugins: [docsite({ featurePackages: ['@probe/feature'] }), fumadocsMdx(), tailwindcss(), reactRouter()],
})
