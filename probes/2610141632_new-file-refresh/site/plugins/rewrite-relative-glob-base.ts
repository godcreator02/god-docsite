import path from 'node:path'
import { normalizePath, type Plugin } from 'vite'

/**
 * 方案 B：把 fumadocs-mdx 生成的 import.meta.glob 相对 base（`"base": "./../content"`）改写成以 `/` 开头的
 * 项目根路径，绕开 Vite 在 Windows 上解析相对 base 的缺陷。要排在 fumadocsMdx() 之后、vite:import-glob 之前
 * （普通插件即可）。依赖 fumadocs-mdx codegen 的输出格式：JSON.stringify 出来的 "base" 键
 */
const relativeBasePattern = /"base":\s*"(\.{1,2}\/[^"]*)"/g

export function rewriteRelativeGlobBase(): Plugin {
  let root = ''
  return {
    name: 'rewrite-relative-glob-base',
    configResolved(config) {
      root = normalizePath(config.root)
    },
    transform(code, id) {
      if (!code.includes('import.meta.glob')) return
      const importerDir = path.dirname(id.split('?')[0]!)
      let rewritten = 0
      const result = code.replace(relativeBasePattern, (_match, relativeBase: string) => {
        const absoluteBase = normalizePath(path.resolve(importerDir, relativeBase))
        if (!absoluteBase.startsWith(`${root}/`)) throw new Error(`glob base ${relativeBase}（${id}）解析到项目根之外：${absoluteBase}`)
        rewritten += 1
        return `"base": ${JSON.stringify(absoluteBase.slice(root.length))}`
      })
      if (rewritten === 0) return
      console.log(`@@probe ${JSON.stringify({ t: Date.now(), event: 'rewrite-base', id: normalizePath(id), rewritten })}`)
      return { code: result, map: null }
    },
  }
}
