import { browserImports } from '@godcreator/gwb-shell/browser-imports'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { build } from 'esbuild'

/** 浏览器侧（窗格）用 esbuild 打成一个文件；node 侧由 tsc 逐个文件输出，样式由 tailwindcss 输出（build 脚本里紧接着的两步） */
const here = path.dirname(fileURLToPath(import.meta.url))

// 上一次构建留下的文件会随 files 白名单一起发出去，先清空
fs.rmSync(path.join(here, 'dist'), { recursive: true, force: true })

await build({
  entryPoints: ['src/client/index.tsx'],
  outfile: 'dist/client.js',
  external: Object.keys(browserImports()),
  absWorkingDir: here,
  format: 'esm',
  platform: 'browser',
  target: 'es2022',
  bundle: true,
  minify: false,
  legalComments: 'none',
  jsx: 'automatic',
  define: { 'process.env.NODE_ENV': '"production"' },
  logLevel: 'warning',
})

console.log('[gwb-docfirst-workflow] dist/client.js ← src/client/index.tsx')
