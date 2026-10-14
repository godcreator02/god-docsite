import { reactRouter } from '@react-router/dev/vite'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vite'
import { fumadocsMdx } from 'fumadocs-mdx/vite'
import { godDocsite } from '@godcreator/god-docsite/vite'
import * as collections from './source.config.ts'

export default defineConfig({
  plugins: [fumadocsMdx(), tailwindcss(), godDocsite({ collections }), reactRouter()],
  resolve: {
    tsconfigPaths: true,
  },
})
