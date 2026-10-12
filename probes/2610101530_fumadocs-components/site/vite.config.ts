import { defineConfig } from 'vite'
import { collab } from '@godcreator/collab-site/dev-server'

export default defineConfig({ plugins: [collab()] })
