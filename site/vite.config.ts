import { reactRouter } from '@react-router/dev/vite'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vite'
import { fumadocsMdx } from 'fumadocs-mdx/vite'
import { docsite } from '@godcreator/docsite-kit/vite'
import { siteFeatures } from './app/site/features.ts'

export default defineConfig({
  plugins: [docsite({ featurePackages: siteFeatures }), fumadocsMdx(), tailwindcss(), reactRouter()],
})
