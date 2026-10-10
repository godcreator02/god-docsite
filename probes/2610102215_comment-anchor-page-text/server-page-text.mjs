// 用基础包构建产物里的 pageTextOfHtml，算开发服务渲染出的每一页的页面文字，打印长度与 sha1，文字写进 out 目录
import { createHash } from 'node:crypto'
import { mkdirSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

const [kitDir, origin, outDir, ...pages] = process.argv.slice(2)
const { pageTextOfHtml } = await import(pathToFileURL(path.join(kitDir, 'dist/server/page-text.js')).href)
mkdirSync(outDir, { recursive: true })
for (const page of pages) {
  const response = await fetch(new URL(page, origin))
  if (!response.ok) throw new Error(`${page}：${response.status}`)
  const text = pageTextOfHtml(await response.text())
  writeFileSync(path.join(outDir, `${page.replaceAll('/', '_') || '_'}.txt`), text)
  console.log(JSON.stringify({ page, length: text.length, sha1: createHash('sha1').update(text).digest('hex').slice(0, 12) }))
}
