import { afterAll, expect, test } from 'vitest'
import { createServer } from 'vite'
import { writeFile, rm, rename, mkdir } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

/**
 * 真实 dev 服务（react-router dev 同款 Vite 配置，createServer 驱动）的 HTTP 验证：
 * 三格式页面、侧栏导航、中文搜索、内容文件路由，以及内容增删/改名后
 * 页面清单与搜索索引的更新——索引更新走 createFromSource 传函数的公开约定
 */

const siteRoot = fileURLToPath(new URL('..', import.meta.url))
const contentDir = path.join(siteRoot, 'content')
const base = 'http://127.0.0.1:5500'
const port = 5500

let server: Awaited<ReturnType<typeof createServer>> | undefined
const created: string[] = []

afterAll(async () => {
  for (const file of created) await rm(path.join(contentDir, file), { force: true })
  await server?.close()
})

async function startDevServer() {
  server = await createServer({
    root: siteRoot,
    configFile: path.join(siteRoot, 'vite.config.ts'),
    server: { port, host: '127.0.0.1', strictPort: true },
  })
  await server.listen()
}

async function statusOf(url: string) {
  const response = await fetch(url, { redirect: 'manual' })
  await response.arrayBuffer()
  return response.status
}

async function textOf(url: string) {
  const response = await fetch(url)
  return response.text()
}

async function searchHits(query: string) {
  const text = await textOf(`${base}/api/search?query=${encodeURIComponent(query)}`)
  return JSON.parse(text) as Array<{ id: string; type: string; url: string; content: string }>
}

const tempTsx = 'guide/dev-temp.page.tsx'
const tempHtml = 'guide/dev-temp.html'
const renamedTsx = 'guide/dev-renamed.page.tsx'

test('dev：三格式页面、导航、中文搜索与内容文件路由', async () => {
  await startDevServer()

  // 页面与 SSR 正文
  expect(await statusOf(`${base}/`)).toBe(200)
  const quickstart = await textOf(`${base}/guide/quickstart`)
  expect(quickstart).toContain('快速开始')
  expect(quickstart).toContain('图片这样引用同目录文件')
  // 本地图片交给打包器（remarkImage → import）：SSR 流在懒加载边界处挂起，实际渲染在浏览器验收里看
  const counter = await textOf(`${base}/guide/counter`)
  expect(counter).toContain('计数器演示')
  expect(counter).toContain('counter-increment')
  const waveform = await textOf(`${base}/guide/waveform`)
  expect(waveform).toContain('波形图说明')
  expect(waveform).toContain('data-html-page="/api/content/guide/waveform.html"')
  // 侧栏导航：三格式混排在同一棵树（root meta 分组「指南」）
  for (const page of [quickstart, counter, waveform]) {
    expect(page).toContain('指南')
    expect(page).toContain('快速开始')
    expect(page).toContain('计数器演示')
    expect(page).toContain('波形图说明')
  }

  // 中文搜索：三格式都返回有效 URL；标题锚点与正文段落都可命中；threshold 0 拒绝缺字词
  expect((await searchHits('计数器')).some((hit) => hit.url === '/guide/counter')).toBe(true)
  expect((await searchHits('滑块')).some((hit) => hit.url === '/guide/quickstart#搜索中文' || hit.url === '/guide/quickstart')).toBe(true)
  const waveHits = await searchHits('波形图怎么看')
  expect(waveHits.some((hit) => hit.type === 'heading' && hit.url === '/guide/waveform#how-to-read')).toBe(true)
  expect(await searchHits('摩滑')).toEqual([])

  // 内容文件路由：HTML 原样送出、同目录资源、路径逃逸拒绝
  const htmlFile = await fetch(`${base}/api/content/guide/waveform.html`)
  expect(htmlFile.status).toBe(200)
  expect(htmlFile.headers.get('content-type')).toBe('text/html; charset=utf-8')
  expect(await textOf(`${base}/api/content/guide/demo.svg`)).toContain('<svg')
  expect(await statusOf(`${base}/api/content/../package.json`)).toBe(404)

  // Markdown 约定：三格式各走各的通道，都出内容
  expect(await textOf(`${base}/api/markdown?path=/guide/quickstart`)).toContain('MDX 页面的正文走')
  expect(await textOf(`${base}/api/markdown?path=/guide/counter`)).toContain('## 怎么互动')
  expect(await textOf(`${base}/api/markdown?path=/guide/waveform`)).toContain('## 波形图怎么看')
}, 180000)

test('dev：TSX 页面新建、改名、删除后页面与搜索跟着更新', async () => {
  await mkdir(path.join(contentDir, 'guide'), { recursive: true })
  await writeFile(path.join(contentDir, tempTsx), `import { useState } from 'react'
export const meta = { title: '开发临时页', description: 'dev 增删验证。', searchText: '开发临时 增删' }
export default function Page() {
  const [n, setN] = useState(0)
  return <div><h2 id="小节">小节</h2><p>{n}</p><button onClick={() => setN(n + 1)}>加</button></div>
}
`)
  created.push(tempTsx)
  await expect
    .poll(async () => statusOf(`${base}/guide/dev-temp`), { timeout: 15000, interval: 500 })
    .toBe(200)
  await expect
    .poll(async () => (await searchHits('开发临时')).some((hit) => hit.url === '/guide/dev-temp'), { timeout: 15000, interval: 500 })
    .toBe(true)

  await rename(path.join(contentDir, tempTsx), path.join(contentDir, renamedTsx))
  created.push(renamedTsx)
  await expect
    .poll(async () => statusOf(`${base}/guide/dev-renamed`), { timeout: 15000, interval: 500 })
    .toBe(200)
  expect(await statusOf(`${base}/guide/dev-temp`)).toBe(404)

  await rm(path.join(contentDir, renamedTsx))
  await expect
    .poll(async () => statusOf(`${base}/guide/dev-renamed`), { timeout: 15000, interval: 500 })
    .toBe(404)
  await expect
    .poll(async () => (await searchHits('开发临时')).length, { timeout: 15000, interval: 500 })
    .toBe(0)
}, 180000)

test('dev：HTML 页面新建、删除后页面与搜索跟着更新', async () => {
  await writeFile(path.join(contentDir, tempHtml), '<!doctype html><html><head><title>临时HTML</title></head><body><h2 id="temp-sec">临时节</h2><p>临时HTML正文。</p></body></html>')
  created.push(tempHtml)
  await expect
    .poll(async () => statusOf(`${base}/guide/dev-temp`), { timeout: 15000, interval: 500 })
    .toBe(200)
  await expect
    .poll(async () => (await searchHits('临时HTML正文')).some((hit) => hit.url === '/guide/dev-temp#temp-sec'), { timeout: 15000, interval: 500 })
    .toBe(true)

  await rm(path.join(contentDir, tempHtml))
  await expect
    .poll(async () => statusOf(`${base}/guide/dev-temp`), { timeout: 15000, interval: 500 })
    .toBe(404)
}, 180000)

test('dev：新建 MDX 不进清单——fumadocs-mdx 相对 glob base 在 Windows 的已知上游缺陷', async () => {
  // 见 probes/2610112023_docsite-kit-complete/review/20261012-0008-root-cause.md：fumadocs-mdx 生成的
  // 集合 glob base 是相对 .source 的路径，本机 Vite 的 toAbsoluteGlob 相对分支在 Windows 上算出
  // 错误匹配路径，watcher 认不出新文件。TSX/HTML 来源用根路径 glob 不受影响（上面的测试）。
  // 上游修复后这个断言会失败，提醒移除该记录
  await writeFile(path.join(contentDir, 'guide/dev-temp-mdx.mdx'), `---
title: 临时MDX页
description: 对照。
---

正文。
`)
  created.push('guide/dev-temp-mdx.mdx')
  await new Promise((resolve) => setTimeout(resolve, 8000))
  expect(await statusOf(`${base}/guide/dev-temp-mdx`)).toBe(404)
}, 180000)
