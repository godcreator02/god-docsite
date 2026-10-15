import { readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { chromium } from 'playwright'
import { checkRunner, filesUnder, hasViteErrorOverlay, headingOf, markNoReload, problemResults, stepTimeoutMs, stillNoReload, waitForHydrated, watchPage } from '../lib/checks.mjs'

/** 写一条评论并回复：评论面板打开、整页评论、展开回复写回复；返回串 id */
async function writeThreadAndReply(page, { threadText, replyText }) {
  await waitForHydrated(page, '[data-comment-dock-open]')
  await page.click('[data-comment-dock-open]')
  await page.click('[data-new-thread-toggle]')
  await page.fill('[data-new-thread-form] textarea[name="body"]', threadText)
  await page.click('[data-new-thread-form] button[type="submit"]')
  const card = page.locator('[data-comment-card]', { hasText: threadText })
  await card.waitFor({ timeout: stepTimeoutMs })
  const threadId = await card.getAttribute('data-comment-card')
  await page.click(`[data-open-replies="${threadId}"]`)
  await page.fill(`[data-reply-form="${threadId}"] textarea[name="body"]`, replyText)
  await page.click(`[data-reply-form="${threadId}"] button[type="submit"]`)
  await card.locator('[data-reply]', { hasText: replyText }).waitFor({ timeout: stepTimeoutMs })
  return threadId
}

/**
 * 基础站组合（god-docsite + identity + comments）的检查。mode 是 dev 或 start；
 * dev 下多做内容文件增改的几项，start 下多搜构建产物
 */
export async function runBaseChecks({ baseUrl, mode, siteDir, feedToken, runTag }) {
  const results = []
  const problems = []
  const check = checkRunner(results)
  const browser = await chromium.launch({ headless: true })
  try {
    const context = await browser.newContext({ viewport: { width: 1400, height: 900 } })
    const page = await context.newPage()
    watchPage(page, 'A', problems)

    await check('首页打开', async () => {
      const response = await page.goto(`${baseUrl}/`, { waitUntil: 'load' })
      const heading = await headingOf(page)
      return { pass: response?.status() === 200 && heading === '首页', detail: `GET / → ${response?.status()}，h1=${heading}` }
    })

    await check('侧栏站内导航', async () => {
      await waitForHydrated(page, '#nd-sidebar a[href="/writing/collapse-test"]')
      await markNoReload(page)
      await page.click('#nd-sidebar a[href="/writing/collapse-test"]')
      await page.waitForURL(`${baseUrl}/writing/collapse-test`, { timeout: stepTimeoutMs })
      await page.locator('h1', { hasText: '收起内容试验' }).waitFor({ timeout: stepTimeoutMs })
      const kept = await stillNoReload(page)
      return { pass: kept, detail: `点侧栏到评论定位回归页，没有整页刷新=${kept}` }
    })

    await check('内容页直接打开', async () => {
      const response = await page.goto(`${baseUrl}/writing/collapse-test`, { waitUntil: 'load' })
      await waitForHydrated(page, '[data-comment-dock-open]')
      const heading = await headingOf(page)
      const tabs = await page.locator('[role="tab"]').count()
      return { pass: response?.status() === 200 && heading === '收起内容试验' && tabs >= 4, detail: `h1=${heading}，标签页 ${tabs} 个` }
    })

    await check('TSX 页（Tex 公式、组件交互）', async () => {
      await page.goto(`${baseUrl}/tsx-demo`, { waitUntil: 'load' })
      await waitForHydrated(page, '[data-tsx-counter]')
      await page.click('[data-tsx-counter]')
      await page.waitForFunction(() => document.querySelector('[data-tsx-counter]')?.textContent === '1', null, { timeout: stepTimeoutMs })
      const katex = await page.locator('.katex').count()
      const heading = await headingOf(page)
      return { pass: katex >= 1 && heading?.startsWith('TSX 演示页'), detail: `h1=${heading}，.katex ${katex} 个，点一下计数为 1` }
    })

    await check('HTML 页（iframe 与内容文件路由）', async () => {
      await page.goto(`${baseUrl}/html-demo`, { waitUntil: 'load' })
      const src = await page.locator('iframe[data-html-page]').getAttribute('src', { timeout: stepTimeoutMs })
      const response = await fetch(`${baseUrl}${src}`)
      const text = await response.text()
      return { pass: src === '/api/content/html-demo.html' && response.status === 200 && text.includes('HTML 页面的正文'), detail: `iframe src=${src} → ${response.status}` }
    })

    await check('术语标注与 MDX 公式', async () => {
      await page.goto(`${baseUrl}/glossary-demo`, { waitUntil: 'load' })
      const terms = await page.locator('.docsite-term').count()
      const katex = await page.locator('.katex').count()
      return { pass: terms === 1 && katex >= 1, detail: `.docsite-term ${terms} 个（同一词只标第一次），.katex ${katex} 个` }
    })

    await check('侧栏目录切换按钮（root: true 文件夹，DocsLayout 不传 tabs）', async () => {
      await page.goto(`${baseUrl}/guide`, { waitUntil: 'load' })
      const dropdown = await page.locator('#nd-sidebar button', { hasText: '指南' }).count()
      return { pass: dropdown >= 1, detail: `侧栏里写着「指南」的切换按钮 ${dropdown} 个` }
    })

    await check('搜索', async () => {
      const response = await fetch(`${baseUrl}/api/search?query=${encodeURIComponent('收起')}`)
      const hits = await response.json()
      const tsxHits = await (await fetch(`${baseUrl}/api/search?query=${encodeURIComponent('计数器演示')}`)).json()
      const pass = hits.some((hit) => hit.url.startsWith('/writing/collapse-test')) && tsxHits.some((hit) => hit.url.startsWith('/tsx-demo'))
      return { pass, detail: `「收起」${hits.length} 条，「计数器演示」${tsxHits.length} 条` }
    })

    await check('llms 与单页 Markdown', async () => {
      const index = await (await fetch(`${baseUrl}/llms.txt`)).text()
      const full = await (await fetch(`${baseUrl}/llms-full.txt`)).text()
      const markdown = await fetch(`${baseUrl}/api/markdown?path=/writing/collapse-test`)
      const markdownText = await markdown.text()
      const pass = index.includes('[收起内容试验](/writing/collapse-test)') && full.includes('改动 A：开头新插的一段') && full.includes('HTML 页面的正文') && markdownText.includes('## 标签页')
      return { pass, detail: `llms.txt ${index.length} 字，llms-full.txt ${full.length} 字，markdown ${markdown.status}` }
    })

    const commentsDir = path.join(siteDir, 'comments')
    if (mode === 'dev') {
      await check('写评论并回复（dev）', async () => {
        await page.goto(`${baseUrl}/writing/collapse-test`, { waitUntil: 'load' })
        const threadId = await writeThreadAndReply(page, { threadText: `e2e 评论 ${runTag}`, replyText: `e2e 回复 ${runTag}` })
        const pending = await page.locator('[data-comment-pending]').count()
        return { pass: pending === 0, detail: `串 ${threadId} 与回复都显示出来，等编译入口的占位 ${pending} 个` }
      })
    } else {
      await check('写评论（start：写进文件，页面是构建时的快照）', async () => {
        const before = filesUnder(commentsDir).length
        await page.goto(`${baseUrl}/writing/collapse-test`, { waitUntil: 'load' })
        await waitForHydrated(page, '[data-comment-dock-open]')
        await page.click('[data-comment-dock-open]')
        await page.click('[data-new-thread-toggle]')
        await page.fill('[data-new-thread-form] textarea[name="body"]', `e2e start 评论 ${runTag}`)
        const [response] = await Promise.all([
          page.waitForResponse((each) => each.url().includes('/comments') && each.request().method() === 'POST', { timeout: stepTimeoutMs }),
          page.click('[data-new-thread-form] button[type="submit"]'),
        ])
        await page.locator('[data-new-thread-toggle]').waitFor({ timeout: stepTimeoutMs })
        const after = filesUnder(commentsDir).length
        const errors = await page.locator('[data-action-error]').count()
        return { pass: response.status() === 200 && after === before + 1 && errors === 0, detail: `写入 ${response.status()}，评论目录文件 ${before} → ${after}` }
      })
    }

    // start 的评论正文是构建时编译的：只看预置的那串；dev 再看刚写的那串
    const threadsToSee = [{ threadText: 'e2e 预置评论', replyText: 'e2e 预置回复' }]
    if (mode === 'dev') threadsToSee.push({ threadText: `e2e 评论 ${runTag}`, replyText: `e2e 回复 ${runTag}` })
    await check('全站评论页看得到评论与回复', async () => {
      await page.goto(`${baseUrl}/comments`, { waitUntil: 'load' })
      const seen = []
      for (const { threadText, replyText } of threadsToSee) {
        const thread = page.locator('[data-comment-card]', { hasText: threadText })
        await thread.waitFor({ timeout: stepTimeoutMs })
        seen.push(await thread.locator('[data-reply]', { hasText: replyText }).count())
      }
      return { pass: seen.every((count) => count === 1), detail: threadsToSee.map(({ threadText }, index) => `「${threadText}」回复 ${seen[index]} 条`).join('，') }
    })

    await check('侧栏的全站评论入口（页面树插件）', async () => {
      await page.goto(`${baseUrl}/`, { waitUntil: 'load' })
      await waitForHydrated(page, '#nd-sidebar a[href="/comments"]')
      await markNoReload(page)
      await page.click('#nd-sidebar a[href="/comments"]')
      await page.locator('h1', { hasText: '全站评论' }).waitFor({ timeout: stepTimeoutMs })
      return { pass: await stillNoReload(page), detail: '点侧栏入口站内导航到 /comments' }
    })

    await check('推送：一页 action 触发、另一页 EventSource 收到', async () => {
      const subscriber = await context.newPage()
      watchPage(subscriber, 'feed-A', problems)
      await subscriber.goto(`${baseUrl}/`, { waitUntil: 'load' })
      await subscriber.evaluate(
        (url) =>
          new Promise((resolve) => {
            window.__feedMessages = []
            const source = new EventSource(url)
            source.addEventListener('message', (event) => window.__feedMessages.push(JSON.parse(event.data)))
            source.addEventListener('open', () => resolve())
          }),
        `/__docsite/feed/e2e-${mode}`,
      )
      const pusher = await context.newPage()
      watchPage(pusher, 'feed-B', problems)
      await pusher.goto(`${baseUrl}/glossary-demo`, { waitUntil: 'load' })
      const status = await pusher.evaluate(
        async ({ url, token }) => (await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json', 'x-docsite-token': token }, body: JSON.stringify({ note: '推送一' }) })).status,
        { url: `/__docsite/feed/e2e-${mode}`, token: feedToken },
      )
      await subscriber.waitForFunction(() => window.__feedMessages.some((message) => message.note === '推送一'), null, { timeout: stepTimeoutMs })
      const latecomer = await context.newPage()
      watchPage(latecomer, 'feed-C', problems)
      await latecomer.goto(`${baseUrl}/`, { waitUntil: 'load' })
      const first = await latecomer.evaluate(
        (url) =>
          new Promise((resolve) => {
            const source = new EventSource(url)
            source.addEventListener('message', (event) => {
              source.close()
              resolve(JSON.parse(event.data))
            })
          }),
        `/__docsite/feed/e2e-${mode}`,
      )
      const current = await (await fetch(`${baseUrl}/__docsite/feed/e2e-${mode}`)).json()
      const wrongToken = await fetch(`${baseUrl}/__docsite/feed/e2e-${mode}`, { method: 'POST', headers: { 'content-type': 'application/json', 'x-docsite-token': 'wrong' }, body: '{}' })
      await Promise.all([subscriber.close(), pusher.close(), latecomer.close()])
      const pass = status === 204 && first.note === '推送一' && current.note === '推送一' && wrongToken.status === 403
      return { pass, detail: `推 ${status}；后来的订阅者先收到 ${JSON.stringify(first)}；GET 当前值 ${JSON.stringify(current)}；令牌不对 ${wrongToken.status}` }
    })

    if (mode === 'dev') {
      await check('dev 新增内容文件：新地址能打开、已打开页面的侧栏出现它', async () => {
        await page.goto(`${baseUrl}/glossary-demo`, { waitUntil: 'load' })
        await waitForHydrated(page, '#nd-sidebar a[href="/glossary-demo"]')
        await markNoReload(page)
        const slug = `added-${runTag}`
        const addedAt = Date.now()
        writeFileSync(path.join(siteDir, 'content', `${slug}.mdx`), `---\ntitle: 新增的页 ${runTag}\n---\n\n新增文件的正文。\n`)
        let status = 0
        let firstOkRequestMs = 0
        while (Date.now() - addedAt < stepTimeoutMs) {
          const requestStartedAt = Date.now()
          status = (await fetch(`${baseUrl}/${slug}`)).status
          firstOkRequestMs = Date.now() - requestStartedAt
          if (status === 200) break
          await new Promise((resolve) => setTimeout(resolve, 500))
        }
        const openedAfterMs = Date.now() - addedAt
        await page.locator(`#nd-sidebar a[href="/${slug}"]`).waitFor({ timeout: stepTimeoutMs })
        const sidebarAfterMs = Date.now() - addedAt
        const kept = await stillNoReload(page)
        const overlay = await hasViteErrorOverlay(page)
        return {
          pass: status === 200 && kept && !overlay && firstOkRequestMs < 5_000,
          detail: `新地址 ${status}（加文件后 ${openedAfterMs} ms 打开，那次请求 ${firstOkRequestMs} ms）；侧栏 ${sidebarAfterMs} ms 出现，没有整页刷新=${kept}，报错层=${overlay}`,
        }
      })

      await check('dev 改 TSX 页标题：侧栏与正文标题跟着变（不挂标题刷新插件）', async () => {
        await page.goto(`${baseUrl}/tsx-demo`, { waitUntil: 'load' })
        await waitForHydrated(page, '[data-tsx-counter]')
        await markNoReload(page)
        const file = path.join(siteDir, 'content', 'tsx-demo.page.tsx')
        const newTitle = `TSX 演示页改 ${runTag}`
        writeFileSync(file, readFileSync(file, 'utf8').replace(/title: '[^']*'/, `title: '${newTitle}'`))
        const changedAt = Date.now()
        await page.locator('#nd-sidebar a[href="/tsx-demo"]', { hasText: newTitle }).waitFor({ timeout: stepTimeoutMs })
        const sidebarMs = Date.now() - changedAt
        await page.locator('h1', { hasText: newTitle }).waitFor({ timeout: stepTimeoutMs })
        const kept = await stillNoReload(page)
        return { pass: true, detail: `侧栏 ${sidebarMs} ms 后是新标题，正文标题也换了，没有整页刷新=${kept}` }
      })
    } else {
      await check('浏览器产物里没有服务端代码', async () => {
        const clientFiles = filesUnder(path.join(siteDir, 'build', 'client')).filter((file) => file.endsWith('.js'))
        const serverOnlyMarkers = ['node:fs', 'node:path', 'node:crypto', 'DOCSITE_FEED_TOKEN', 'DOCSITE_IDENTITY_CODE', '算不出可信 origin']
        const hits = clientFiles.flatMap((file) => {
          const text = readFileSync(file, 'utf8')
          return serverOnlyMarkers.filter((marker) => text.includes(marker)).map((marker) => `${path.relative(siteDir, file)}: ${marker}`)
        })
        return { pass: hits.length === 0, detail: hits.length === 0 ? `${clientFiles.length} 个 js 里搜不到 ${serverOnlyMarkers.join('、')}` : hits.slice(0, 8).join('；') }
      })
    }
  } finally {
    await browser.close()
  }

  results.push(...problemResults(problems))
  return results
}
