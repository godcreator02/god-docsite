// 评论接口的端到端测试：起真实 Vite 开发服务（加载本站 vite.config.ts，**关闭 HMR**），
// 经 HTTP 走 create→reply→edit→resolve/reopen→删回复→删整串，每一步之后都发新的 GET，
// 断言页面数据正确——它只来自 loader 每次请求重新读盘，不靠 source.config.ts 变化或任何集合失效机制。
// 另断言：写失败的请求（MDX 编译不过）不改数据不改文件；Origin 错误 403；开发服务日志没有对 /comments/ 模块的报错。
// 在 site 目录运行：..\..\packages\docsite-kit\node_modules\.bin\vitest.ps1 run --config test/vitest.config.mjs
import { test, expect } from '../../../../packages/docsite-kit/node_modules/vitest/dist/index.js'
import { createServer } from '../node_modules/vite/dist/node/index.js'
import { readFile, readdir } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const site = fileURLToPath(new URL('../', import.meta.url))
const port = 5462

test('真实站（HMR 关闭）：评论六种写操作后新 GET 都正确，写失败不改数据', async () => {
  const oldCwd = process.cwd()
  const oldCode = process.env.DOCSITE_IDENTITY_CODE
  const oldOrigin = process.env.PROBE_SITE_ORIGIN
  const people = JSON.parse(await readFile(path.join(site, 'people.json'), 'utf8')) as Array<{ id: string; codes?: string[] }>
  process.env.DOCSITE_IDENTITY_CODE = people.find((person) => person.id === 'zk')!.codes![0]
  process.env.PROBE_SITE_ORIGIN = `http://127.0.0.1:${port}`
  const sourceConfigBefore = await readFile(path.join(site, 'source.config.ts'), 'utf8')
  process.chdir(site)

  let server: Awaited<ReturnType<typeof createServer>> | undefined
  let thread: string | undefined
  const commentErrors: string[] = []
  const marker = 'e2e-hmr-off-' + Date.now()
  const post = async (args: Record<string, string>, origin = `http://127.0.0.1:${port}`) => {
    const body = new FormData()
    for (const [key, value] of Object.entries(args)) body.set(key, value)
    return fetch(`http://127.0.0.1:${port}/api/comments`, { method: 'POST', body, headers: { Origin: origin } })
  }
  const pageText = async () => await (await fetch(`http://127.0.0.1:${port}/comments`)).text()

  try {
    server = await createServer({
      root: site,
      configFile: path.join(site, 'vite.config.ts'),
      server: { port, host: '127.0.0.1', strictPort: true, hmr: false },
    })
    for (const level of ['error', 'warn'] as const) {
      const original = server.config.logger[level].bind(server.config.logger)
      server.config.logger[level] = (...args: unknown[]) => {
        const text = args.map(String).join(' ')
        if (text.includes('/comments/')) commentErrors.push(`${level}: ${text.slice(0, 200)}`)
        original(...args)
      }
    }
    await server.listen()
    expect((await fetch(`http://127.0.0.1:${port}/comments`)).status).toBe(200)
    const before = await pageText()

    // 新建（正文带链接）：新的 GET 里出现这一串与正文文字（loader 把编译后的正文也带给浏览器）
    const created = await post({ op: 'create', body: `${marker}：带[链接](https://example.com/e2e)的正文。` })
    expect(created.status).toBe(200)
    thread = ((await created.json()) as { thread: string }).thread
    expect((await readdir(path.join(site, 'comments'))).includes(thread)).toBe(true)
    await expect.poll(async () => (await pageText()).includes(thread), { timeout: 5000, interval: 300 }).toBe(true)
    expect(await pageText()).toContain(marker)

    // 回复
    const replied = await post({ op: 'reply', thread, body: '回复一条，等下编辑再删掉。' })
    expect(replied.status).toBe(200)
    const replyFile = ((await replied.json()) as { file: string }).file
    await expect.poll(async () => (await pageText()).includes(replyFile), { timeout: 5000, interval: 300 }).toBe(true)

    // 编辑
    const edited = await post({ op: 'edit', thread, file: 'index.mdx', body: `${marker}：编辑后的正文，换了一句[话](https://example.com/edited)。` })
    expect(edited.status).toBe(200)
    await expect.poll(async () => (await pageText()).includes('编辑后的正文'), { timeout: 5000, interval: 300 }).toBe(true)
    expect(await pageText()).not.toContain('带[链接]') // 旧的 MDX 源码文字不再出现在页面（编译产物里只有渲染后的）

    // 解决 → 重开：默认的「未解决」筛选下，解决后这一串从列表消失，重开后回来
    expect((await post({ op: 'resolve', thread })).status).toBe(200)
    await expect.poll(async () => (await pageText()).includes(thread!), { timeout: 5000, interval: 300 }).toBe(false)
    expect((await post({ op: 'reopen', thread })).status).toBe(200)
    await expect.poll(async () => (await pageText()).includes(thread!), { timeout: 5000, interval: 300 }).toBe(true)

    // 删回复：串保留
    expect((await post({ op: 'delete', thread, file: replyFile })).status).toBe(200)
    await expect.poll(async () => (await pageText()).includes(replyFile), { timeout: 5000, interval: 300 }).toBe(false)
    expect(await pageText()).toContain(thread)

    // 写失败（MDX 编译不过）：400，数据与文件都不变
    const badBody = '第一行\n看这里 <b> {x'
    const failed = await post({ op: 'reply', thread, body: badBody })
    expect(failed.status).toBe(400)
    expect(await pageText()).not.toContain(badBody)
    expect((await readdir(path.join(site, 'comments', thread!))).filter((file) => file.endsWith('.mdx'))).toEqual(['index.mdx'])

    // Origin 错误：403
    const badOrigin = await post({ op: 'reply', thread, body: 'x' }, 'http://evil.example')
    expect(badOrigin.status).toBe(403)

    // 删整串
    expect((await post({ op: 'delete', thread, file: 'index.mdx' })).status).toBe(200)
    await expect.poll(async () => (await pageText()).includes(thread!), { timeout: 5000, interval: 300 }).toBe(false)
    expect((await fetch(`http://127.0.0.1:${port}/comments`)).status).toBe(200)

    // 其他串不受影响
    const after = await pageText()
    expect(after).toContain('2026-10-11-seed-welcome')
    expect(after).toContain('2026-10-12-mdx-capabilities')

    // 全程没有对评论模块的服务端报错，接口也没碰 source.config.ts
    expect(commentErrors).toEqual([])
    expect(await readFile(path.join(site, 'source.config.ts'), 'utf8')).toBe(sourceConfigBefore)
    expect(before.length).toBeGreaterThan(0)
  } finally {
    if (thread && (await readdir(path.join(site, 'comments'))).includes(thread)) await post({ op: 'delete', thread, file: 'index.mdx' })
    await server?.close()
    process.chdir(oldCwd)
    if (oldCode === undefined) delete process.env.DOCSITE_IDENTITY_CODE
    else process.env.DOCSITE_IDENTITY_CODE = oldCode
    if (oldOrigin === undefined) delete process.env.PROBE_SITE_ORIGIN
    else process.env.PROBE_SITE_ORIGIN = oldOrigin
    if (commentErrors.length > 0) console.log('commentErrors:', JSON.stringify(commentErrors, null, 2))
  }
})
