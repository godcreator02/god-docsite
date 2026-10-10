import { reactRouter } from '@react-router/dev/vite'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vite'
import { fumadocsMdx } from 'fumadocs-mdx/vite'
import { docsite } from '@godcreator/docsite-kit/vite'

export default defineConfig({
  plugins: [docsite(), fumadocsMdx(), tailwindcss(), reactRouter()],
})
