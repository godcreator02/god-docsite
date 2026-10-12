import { afterAll, beforeAll, expect, test } from 'vitest'
import { spawn, execSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { readFile, rename, rm, writeFile } from 'node:fs/promises'
import { setTimeout as delay } from 'node:timers/promises'

/**
 * build + start 快照验证：构建后的站（react-router build → react-router-serve）上
 * 三格式页面、中文搜索、Markdown 与内容文件路由都照常工作。
 * build 只做一次（beforeAll），serve 起在 5501
 */

const siteRoot = fileURLToPath(new URL('..', import.meta.url))
const base = 'http://127.0.0.1:5501'
let serve: ReturnType<typeof spawn> | undefined

async function textOf(url: string) {
  const response = await fetch(url)
  return { status: response.status, text: await response.text(), contentType: response.headers.get('content-type') ?? '' }
}

async function searchHits(query: string) {
  const { text } = await textOf(`${base}/api/search?query=${encodeURIComponent(query)}`)
  return JSON.parse(text) as Array<{ type: string; url: string; content: string }>
}

beforeAll(async () => {
  execSync('pnpm build', { cwd: siteRoot, stdio: 'pipe' })
}, 300000)

beforeAll(async () => {
  serve = spawn(process.execPath, ['node_modules/@react-router/serve/bin.cjs', './build/server/index.js'], {
    cwd: siteRoot,
    env: { ...process.env, PORT: '5501', HOSTNAME: '127.0.0.1' },
    stdio: 'pipe',
  })
  for (let i = 0; i < 60; i++) {
    try {
      await fetch(base)
      return
    } catch {
      await delay(500)
    }
  }
  throw new Error('serve 没在 30 秒内起来')
}, 120000)

afterAll(() => {
  serve?.kill()
  if (serve && !serve.killed) execSync(`taskkill /PID ${serve.pid} /T /F`, { stdio: 'pipe' })
})

test('start：三格式页面渲染', async () => {
  const home = await textOf(`${base}/`)
  expect(home.status).toBe(200)
  expect(home.text).toContain('三种页面来源')

  const quickstart = await textOf(`${base}/guide/quickstart`)
  expect(quickstart.status).toBe(200)
  expect(quickstart.text).toContain('快速开始')
  expect(quickstart.text).toContain('约定')

  const counter = await textOf(`${base}/guide/counter`)
  expect(counter.status).toBe(200)
  expect(counter.text).toContain('计数器演示')
  expect(counter.text).toContain('counter-increment')

  const waveform = await textOf(`${base}/guide/waveform`)
  expect(waveform.status).toBe(200)
  expect(waveform.text).toContain('波形图说明')
  expect(waveform.text).toContain('data-html-page="/api/content/guide/waveform.html"')

  // 侧栏导航：三格式混排
  expect(waveform.text).toContain('快速开始')
  expect(waveform.text).toContain('计数器演示')
})

test('start：中文搜索返回有效 URL（含锚点），缺字词不命中', async () => {
  expect((await searchHits('计数器')).some((hit) => hit.url === '/guide/counter')).toBe(true)
  expect((await searchHits('滑块')).some((hit) => hit.url.startsWith('/guide/quickstart'))).toBe(true)
  expect((await searchHits('波形图怎么看')).some((hit) => hit.type === 'heading' && hit.url === '/guide/waveform#how-to-read')).toBe(true)
  expect(await searchHits('摩滑')).toEqual([])
})

test('start：内容文件路由与 Markdown 约定', async () => {
  const htmlFile = await textOf(`${base}/api/content/guide/waveform.html`)
  expect(htmlFile.status).toBe(200)
  expect(htmlFile.contentType).toBe('text/html; charset=utf-8')
  const svg = await textOf(`${base}/api/content/guide/demo.svg`)
  expect(svg.status).toBe(200)
  expect(svg.text).toContain('<svg')

  expect((await textOf(`${base}/api/markdown?path=/guide/quickstart`)).text).toContain('MDX 页面的正文走')
  expect((await textOf(`${base}/api/markdown?path=/guide/counter`)).text).toContain('## 怎么互动')
  expect((await textOf(`${base}/api/markdown?path=/guide/waveform`)).text).toContain('## 波形图怎么看')
})

test('start：不存在的页面 404', async () => {
  expect((await textOf(`${base}/guide/nope`)).status).toBe(404)
})

test('start：构建后修改、移走源 HTML 与图片，正文/资源/元数据仍是构建快照', async () => {
  const htmlPath = path.join(siteRoot, 'content/guide/waveform.html')
  const svgPath = path.join(siteRoot, 'content/guide/demo.svg')
  const originalHtml = await readFile(htmlPath, 'utf8')
  const originalSvg = await readFile(svgPath, 'utf8')
  try {
    await writeFile(htmlPath, originalHtml.replaceAll('波形图说明', '被篡改的新标题').replaceAll('波形图怎么看', '被篡改的新小节'))
    await rename(svgPath, `${svgPath}.moved-away`)

    const file = await textOf(`${base}/api/content/guide/waveform.html`)
    expect(file.status).toBe(200)
    expect(file.text).toContain('波形图说明')
    expect(file.text).not.toContain('被篡改')

    const svg = await textOf(`${base}/api/content/guide/demo.svg`)
    expect(svg.status).toBe(200)
    expect(svg.text).toContain('波形示意')

    const page = await textOf(`${base}/guide/waveform`)
    expect(page.status).toBe(200)
    expect(page.text).toContain('波形图说明')
    expect(page.text).not.toContain('被篡改')
    expect(await searchHits('被篡改')).toEqual([])
    expect((await searchHits('波形图怎么看')).length).toBeGreaterThan(0)
  } finally {
    await writeFile(htmlPath, originalHtml)
    await writeFile(svgPath, originalSvg)
    await rm(`${svgPath}.moved-away`, { force: true })
  }
})
