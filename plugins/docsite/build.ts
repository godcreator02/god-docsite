import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { build } from 'esbuild'

/**
 * node 侧用 esbuild 打成一个文件，外置名单之外的依赖全部打包进去；类型入口由紧接着的 tsc 输出。
 * 平台建站器 @godcreator/god-docsite/scaffold 不打包：源码按算出的地址 import(变量) 加载，esbuild 不跟进
 */
const here = path.dirname(fileURLToPath(import.meta.url))

/**
 * 外置名单：peer 里的包（home 里装着）以及 cordis——按值 import 了 cordis 却没写进 peer 时，
 * 产物里留下包名、被发版前检查拦住，而不是悄悄打包进一份拷贝
 */
function nodeSideExternals(): string[] {
  const manifest: unknown = JSON.parse(fs.readFileSync(path.join(here, 'package.json'), 'utf8'))
  const peers = isRecord(manifest) && isRecord(manifest['peerDependencies']) ? Object.keys(manifest['peerDependencies']) : []
  return ['cordis', ...peers]
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

// 上一次构建留下的文件会随 files 白名单一起发出去，先清空
fs.rmSync(path.join(here, 'dist'), { recursive: true, force: true })
fs.mkdirSync(path.join(here, 'dist'), { recursive: true })

await build({
  entryPoints: ['src/index.ts'],
  outfile: 'dist/index.js',
  external: nodeSideExternals(),
  // 打包进来的 CommonJS 依赖会 require node 内置模块；ESM 产物里没有 require，
  // esbuild 的 __require 执行到就抛「Dynamic require ... is not supported」。在产物开头用 createRequire 造一个
  banner: { js: 'import { createRequire as __createRequire } from "node:module";\nconst require = __createRequire(import.meta.url);' },
  format: 'esm',
  platform: 'node',
  target: 'node22',
  bundle: true,
  minify: false,
  legalComments: 'none',
  logLevel: 'warning',
  absWorkingDir: here,
})

console.log('[docsite] dist/index.js ← src/index.ts')
