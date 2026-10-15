import { readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { checkRunner, filesUnder, hasViteErrorOverlay, headingOf, markNoReload, openCommentsInbox, postFormToAction, problemResults, serverCodeInClientBuild, stepTimeoutMs, stillNoReload, waitForHydrated, watchPage } from '../lib/checks.mjs'
import { addedPageOf, titlePageOf } from '../lib/run-scratch.mjs'

/** 侧栏站名下的一横排：搜索按钮与功能入口（god-docsite 的 SidebarLinksRow） */
const sidebarRow = '#nd-sidebar [data-docsite-sidebar-row]'

/**
 * 写一条评论并回复：打开收件箱，在底部批整页；发出去以后这一串浮在正文顶上（data-comment-card），在它的回复框里回复；
 * 收件箱里多出这一行。返回串 id
 */
async function writeThreadAndReply(page, { threadText, replyText }) {
  await openCommentsInbox(page)
  await page.fill('[data-new-thread-form] textarea[name="body"]', threadText)
  await page.click('[data-new-thread-form] button[type="submit"]')
  const card = page.locator('[data-comment-card]', { hasText: threadText })
  await card.waitFor({ timeout: stepTimeoutMs })
  const threadId = await card.getAttribute('data-comment-card')
  await page.locator(`[data-comment-row="${threadId}"]`).waitFor({ timeout: stepTimeoutMs })
  await page.fill(`[data-reply-form="${threadId}"] textarea[name="body"]`, replyText)
  await page.click(`[data-reply-form="${threadId}"] button[type="submit"]`)
  await card.locator('[data-reply]', { hasText: replyText }).waitFor({ timeout: stepTimeoutMs })
  return threadId
}

/** 在收件箱里点开一串，等它浮在正文上；返回那一串的 locator */
async function openThreadFromInbox(page, threadId) {
  await openCommentsInbox(page)
  await page.click(`[data-comment-row="${threadId}"]`)
  const card = page.locator(`[data-comments-layer] [data-comment-card="${threadId}"]`)
  await card.waitFor({ timeout: stepTimeoutMs })
  return card
}

/** 悬停串头露出状态按钮再点；返回点之前按钮的名字 */
async function clickThreadStatusToggle(card, threadId) {
  await card.locator('.docsite-comment').first().hover()
  const toggle = card.locator(`[data-thread-status-toggle="${threadId}"]`)
  const label = (await toggle.getAttribute('aria-label')) ?? ''
  await toggle.click()
  return label
}

/**
 * 等串头文件写上 status 行，再等浮着的这一串显示同样的 data-thread-status。
 * dev 下改已有的串头文件，Vite 热更新不了它、整页刷新，浮着的这一串随之收起（收件箱记着开着），就从收件箱再点开
 */
async function waitForThreadStatus(page, { threadId, headFile, status }) {
  const deadline = Date.now() + stepTimeoutMs
  const statusLine = `status: "${status}"`
  while (!readFileSync(headFile, 'utf8').split(/\r?\n/).includes(statusLine)) {
    if (Date.now() > deadline) throw new Error(`${headFile} 等不到「${statusLine}」`)
    await new Promise((resolve) => setTimeout(resolve, 200))
  }
  const shown = page.locator(`[data-comments-layer] [data-comment-card="${threadId}"][data-thread-status="${status}"]`)
  while (Date.now() < deadline) {
    if (await shown.count()) return shown
    const stillOpen = await page.locator(`[data-comments-layer] [data-comment-card="${threadId}"]`).count()
    const rowShown = await page.locator(`[data-comment-row="${threadId}"]`).count()
    if (!stillOpen && rowShown) await page.click(`[data-comment-row="${threadId}"]`).catch(() => {})
    await new Promise((resolve) => setTimeout(resolve, 300))
  }
  throw new Error(`串 ${threadId} 在页面上等不到 data-thread-status="${status}"`)
}

/**
 * 基础站（god-docsite + identity + comments）的检查。mode 是 dev 或 start；
 * dev 下写评论，并多做内容文件增改的几项（改的是本次运行新建的临时页）；start 是只读的发布版，核对写不进去，并多搜构建产物。
 * 评论只写在「收起内容试验」这一页，正文带 runTag，跑完删掉
 */
export async function runBaseChecks({ browser, baseUrl, mode, siteDir, feedToken, runTag }) {
  const results = []
  const problems = []
  const check = checkRunner(results)
  const context = await browser.newContext({ viewport: { width: 1400, height: 900 } })
  try {
    const page = await context.newPage()
    watchPage(page, 'base', problems)

    await check('首页打开：HomeLayout，没有侧栏；顶栏有「文档」与功能入口；正文是协作的项目首页（任务、模块、日志、成员四栏）', async () => {
      const response = await page.goto(`${baseUrl}/`, { waitUntil: 'load' })
      const heading = await headingOf(page)
      const sidebars = await page.locator('#nd-sidebar').count()
      const navLinks = await page.locator('header a[href]').evaluateAll((links) => links.map((link) => `${link.getAttribute('href')} ${link.textContent?.trim()}`))
      const missingNav = ['/about 文档', '/tasks 任务', '/calendar 日历', '/trajectory 轨迹', '/comments 评论'].filter((entry) => !navLinks.includes(entry))
      const sections = await page.locator('main section h2').allTextContents()
      // dev 下有本机身份，只列我的任务；start 是只读的发布版，列全部
      const taskSection = mode === 'dev' ? '我没做完的任务' : '没做完的任务'
      const missingSections = [taskSection, '快到期的模块', '最近的日志', '成员'].filter((title) => !sections.includes(title))
      const recordLinks = await page.locator('main section a[href^="/tasks/"]').count()
      return {
        pass: response?.status() === 200 && heading === '协作站测试' && sidebars === 0 && missingNav.length === 0 && missingSections.length === 0 && recordLinks > 0,
        detail: `GET / → ${response?.status()}，h1=${heading}，侧栏 ${sidebars} 个；顶栏缺 ${missingNav.join('、') || '无'}；缺的栏 ${missingSections.join('、') || '无'}；指向任务或模块的链接 ${recordLinks} 个`,
      }
    })

    await check('首页顶栏的「文档」站内导航到第一组的第一页（带侧栏）', async () => {
      await waitForHydrated(page, 'header a[href="/about"]')
      await page.waitForLoadState('networkidle')
      await markNoReload(page)
      await page.click('header a[href="/about"]')
      await page.locator('h1', { hasText: '这个测试站是什么' }).waitFor({ timeout: stepTimeoutMs })
      const sidebars = await page.locator('#nd-sidebar').count()
      const kept = await stillNoReload(page)
      return { pass: kept && sidebars === 1, detail: `到 /about，没有整页刷新=${kept}，侧栏 ${sidebars} 个` }
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
      await waitForHydrated(page, '[data-comment-inbox-toggle]')
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

    await check('术语有可见的标注（平台 styles.css：词下点线、问号光标），悬停弹出释义', async () => {
      await page.goto(`${baseUrl}/glossary-demo`, { waitUntil: 'load' })
      const word = page.locator('.docsite-term-word').first()
      const style = await word.evaluate((element) => {
        const computed = getComputedStyle(element)
        return { border: `${computed.borderBottomWidth} ${computed.borderBottomStyle}`, cursor: computed.cursor }
      })
      const pop = page.locator('.docsite-term-pop').first()
      const hiddenBefore = await pop.evaluate((element) => getComputedStyle(element).display)
      await word.hover()
      const shownAfter = await pop.evaluate((element) => getComputedStyle(element).display)
      const pass = style.border === '1px dotted' && style.cursor === 'help' && hiddenBefore === 'none' && shownAfter === 'block'
      return { pass, detail: `词的下边框 ${style.border}、光标 ${style.cursor}；释义悬停前 display=${hiddenBefore}，悬停后 ${shownAfter}` }
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

      await check('标为已解决、重新打开（dev）：在收件箱点开这一串，悬停串头点状态按钮，按钮跟着变，串头写上 status、resolvedBy、resolvedAt，重新打开后去掉', async () => {
        await page.goto(`${baseUrl}/writing/collapse-test`, { waitUntil: 'load' })
        await page.waitForLoadState('networkidle')
        await openCommentsInbox(page)
        const row = page.locator('[data-comment-row]', { hasText: `e2e 评论 ${runTag}` })
        await row.waitFor({ timeout: stepTimeoutMs })
        const threadId = await row.getAttribute('data-comment-row')
        const headFile = path.join(commentsDir, threadId, 'index.mdx')
        const openLabel = await clickThreadStatusToggle(await openThreadFromInbox(page, threadId), threadId)
        const resolvedCard = await waitForThreadStatus(page, { threadId, headFile, status: 'resolved' })
        const resolvedText = readFileSync(headFile, 'utf8')
        const resolvedLabel = await clickThreadStatusToggle(resolvedCard, threadId)
        await waitForThreadStatus(page, { threadId, headFile, status: 'open' })
        const reopenedText = readFileSync(headFile, 'utf8')
        const resolvedWritten = /^status: "resolved"$/m.test(resolvedText) && /^resolvedBy: "[^"]+"$/m.test(resolvedText) && /^resolvedAt: "[^"]+"$/m.test(resolvedText)
        const reopenedWritten = /^status: "open"$/m.test(reopenedText) && !/^resolved(By|At):/m.test(reopenedText)
        const pass = resolvedWritten && openLabel === '标为已解决' && resolvedLabel === '重新打开' && reopenedWritten
        return { pass, detail: `未解决时按钮写「${openLabel}」，标了以后写「${resolvedLabel}」、串头 status 行 ${resolvedText.match(/^status: .*$/m)?.[0]}；重新打开后 ${reopenedText.match(/^status: .*$/m)?.[0]}，还有 resolvedBy/At：${/^resolved(By|At):/m.test(reopenedText)}` }
      })

      await check('批注一块（dev）：草稿与这一串浮在那一块正下方、不挤动正文；再点那一块收起浮窗，收件箱不跟着收', async () => {
        const commentText = `e2e 批一块 ${runTag}`
        await page.goto(`${baseUrl}/writing/collapse-test`, { waitUntil: 'load' })
        await page.waitForLoadState('networkidle')
        await openCommentsInbox(page)
        const paragraphs = page.locator('[data-comment-scope] p')
        const block = paragraphs.first()
        const documentTopOf = (locator) => locator.evaluate((element) => element.getBoundingClientRect().top + window.scrollY)
        const nextTopBefore = await documentTopOf(paragraphs.nth(1))
        await page.click('[data-comment-picking-toggle]')
        await block.click()
        await page.fill('[data-comment-draft-form] textarea[name="body"]', commentText)
        await page.click('[data-comment-draft-form] button[type="submit"]')
        const card = page.locator('[data-comments-layer] [data-comment-card]', { hasText: commentText })
        await card.waitFor({ timeout: stepTimeoutMs })
        const blockBottom = await block.evaluate((element) => element.getBoundingClientRect().bottom + window.scrollY)
        const layerTop = await page.locator('[data-comments-layer]').evaluate((element) => element.getBoundingClientRect().top + window.scrollY)
        const nextTopAfter = await documentTopOf(paragraphs.nth(1))
        const marked = await block.getAttribute('data-commented-element')
        await block.click()
        await card.waitFor({ state: 'detached', timeout: stepTimeoutMs })
        const inboxes = await page.locator('[data-comments-inbox]').count()
        const below = layerTop > blockBottom && layerTop - blockBottom < 24
        return {
          pass: below && nextTopAfter === nextTopBefore && marked === 'active' && inboxes === 1,
          detail: `浮窗顶边比那一块底边低 ${Math.round(layerTop - blockBottom)}px；下一段的位置 ${nextTopBefore} → ${nextTopAfter}；那一块标成 ${marked}；再点一下浮窗收起，收件箱 ${inboxes} 个`,
        }
      })
    } else {
      await check('start 只读：收件箱没有写入口、写明原因，直接提交被拒且不写文件（服务有身份码也不认）', async () => {
        const before = filesUnder(commentsDir).length
        await page.goto(`${baseUrl}/writing/collapse-test`, { waitUntil: 'load' })
        await openCommentsInbox(page)
        const reason = page.locator('[data-readonly-reason]')
        await reason.waitFor({ timeout: stepTimeoutMs })
        const reasonText = ((await reason.textContent()) ?? '').trim()
        const writeForms = await page.locator('[data-new-thread-form], [data-comment-picking-toggle]').count()
        const rejected = await postFormToAction(baseUrl, '/comments.data', { intent: 'create-thread', page: 'writing/collapse-test.mdx', body: `e2e start 评论 ${runTag}` })
        const after = filesUnder(commentsDir).length
        const pass = reasonText.includes('发布版') && writeForms === 0 && rejected.status === 403 && rejected.text.includes('发布版') && after === before
        return { pass, detail: `收件箱写着「${reasonText}」，批整页的输入框与批注按钮 ${writeForms} 个；直接提交 → ${rejected.status}，评论目录文件 ${before} → ${after}` }
      })

      await check('start 只读：在收件箱点开预置的那串，没有「标为已解决」按钮，直接提交 resolve-thread 被拒、串头不变', async () => {
        const presetHead = filesUnder(commentsDir).find((file) => path.basename(file) === 'index.mdx' && readFileSync(file, 'utf8').includes('e2e 预置评论'))
        if (presetHead === undefined) throw new Error(`${commentsDir} 里找不到正文是「e2e 预置评论」的串头`)
        const threadId = path.basename(path.dirname(presetHead))
        const before = readFileSync(presetHead, 'utf8')
        await page.goto(`${baseUrl}/writing/collapse-test`, { waitUntil: 'load' })
        const card = await openThreadFromInbox(page, threadId)
        const statusToggles = await card.locator('[data-thread-status-toggle]').count()
        const rejected = await postFormToAction(baseUrl, '/comments.data', { intent: 'resolve-thread', threadId })
        const unchanged = readFileSync(presetHead, 'utf8') === before
        return { pass: statusToggles === 0 && rejected.status === 403 && unchanged, detail: `点开的那串里状态按钮 ${statusToggles} 个；直接提交 → ${rejected.status}；预置串 ${threadId} 的串头${unchanged ? '没变' : '变了'}` }
      })
    }

    // start 只读、评论正文是构建时编译的：只看预置的那串；dev 再看刚写的那串
    const threadsToSee = [{ threadText: 'e2e 预置评论', replyText: 'e2e 预置回复' }]
    if (mode === 'dev') threadsToSee.push({ threadText: `e2e 评论 ${runTag}`, replyText: `e2e 回复 ${runTag}` })
    await check('全站评论表格：一行一串，点行展开看得到评论与回复', async () => {
      await page.goto(`${baseUrl}/comments`, { waitUntil: 'load' })
      await waitForHydrated(page, '[data-comment-row]')
      // dev 下首次打开会因依赖预构建整页刷新一次：等它安定再点，不然点开的行随刷新收回去
      await page.waitForLoadState('networkidle')
      const seen = []
      for (const { threadText, replyText } of threadsToSee) {
        const row = page.locator('[data-comment-row]', { hasText: threadText })
        await row.waitFor({ timeout: stepTimeoutMs })
        const threadId = await row.getAttribute('data-comment-row')
        await row.click()
        const thread = page.locator(`[data-comment-card="${threadId}"]`)
        await thread.waitFor({ timeout: stepTimeoutMs })
        seen.push(await thread.locator('[data-reply]', { hasText: replyText }).count())
      }
      return { pass: seen.every((count) => count === 1), detail: threadsToSee.map(({ threadText }, index) => `「${threadText}」展开后回复 ${seen[index]} 条`).join('，') }
    })

    await check('侧栏横排的「评论」入口（comments 的 sidebarLinks）', async () => {
      await page.goto(`${baseUrl}/about`, { waitUntil: 'load' })
      await waitForHydrated(page, `${sidebarRow} a[href="/comments"]`)
      await markNoReload(page)
      await page.click(`${sidebarRow} a[href="/comments"]`)
      await page.locator('h1', { hasText: '全站评论' }).waitFor({ timeout: stepTimeoutMs })
      return { pass: await stillNoReload(page), detail: '点横排里的「评论」站内导航到 /comments' }
    })

    await check('侧栏站名下是一横排：最左是只有图标的搜索按钮，后面的入口都带图标；一行最多四格、各行格数平均、字没被截掉；侧栏里没有整行的搜索框', async () => {
      await page.goto(`${baseUrl}/about`, { waitUntil: 'load' })
      await waitForHydrated(page, `${sidebarRow} a[href="/comments"]`)
      const cells = await page.locator(`${sidebarRow} [data-docsite-sidebar-cell]`).evaluateAll((spans) =>
        spans.map((span) => {
          const control = span.querySelector('a, button')
          return {
            tag: control?.tagName.toLowerCase(),
            href: control?.getAttribute('href') ?? null,
            text: control?.textContent?.trim() ?? '',
            icon: control?.querySelector('svg') !== null,
            clipped: control !== null && control.scrollWidth > control.clientWidth,
          }
        }),
      )
      const cellsPerLine = await page.locator(`${sidebarRow} [data-docsite-sidebar-line]`).evaluateAll((lines) => lines.map((line) => line.querySelectorAll('[data-docsite-sidebar-cell]').length))
      const [search, ...links] = cells
      const searchOk = search?.tag === 'button' && search.text === '' && search.icon
      const linksOk = links.length > 0 && links.every((cell) => cell.tag === 'a' && cell.icon && cell.text !== '')
      const clipped = cells.filter((cell) => cell.clipped).map((cell) => cell.href ?? '搜索')
      const linesOk =
        cellsPerLine.every((count) => count <= 4) && Math.max(...cellsPerLine) - Math.min(...cellsPerLine) <= 1 && cellsPerLine.reduce((sum, count) => sum + count, 0) === cells.length
      const fullSearchBars = await page.locator('#nd-sidebar button', { has: page.locator('kbd') }).count()
      // dev 下搜索框的代码按需加载：没加载完就点，fumadocs 记成已打开却画不出来，之后 Ctrl K 也打不开（main 上整行搜索框一样）
      await page.waitForLoadState('networkidle')
      await page.click(`${sidebarRow} button[data-search]`)
      const dialog = await page.locator('input[data-fd-search-dialog-input]').waitFor({ timeout: stepTimeoutMs }).then(() => true, () => false)
      await page.keyboard.press('Escape')
      return {
        pass: searchOk && linksOk && clipped.length === 0 && linesOk && fullSearchBars === 0 && dialog,
        detail: `横排 ${cells.map((cell) => (cell.href ?? '搜索') + (cell.icon ? '(图标)' : '')).join('、')}，每行 ${cellsPerLine.join(' + ')} 格；入口都有字=${linksOk}；字被截掉的 ${clipped.join('、') || '无'}；侧栏里带快捷键的整行搜索框 ${fullSearchBars} 个；点搜索按钮弹出搜索框=${dialog}`,
      }
    })

    await check('每一页侧栏都有目录切换按钮：组外的页面收在以站名命名的那一组里，功能页面也有', async () => {
      const outcomes = []
      for (const { url, group } of [
        { url: '/about', group: '协作站测试' },
        { url: '/writing/collapse-test', group: '协作站测试' },
        { url: '/guide', group: '指南' },
        { url: '/tasks', group: '协作站测试' },
      ]) {
        await page.goto(`${baseUrl}${url}`, { waitUntil: 'load' })
        await waitForHydrated(page, `${sidebarRow} a[href="/comments"]`)
        const toggles = await page.locator('#nd-sidebar button', { hasText: group }).count()
        outcomes.push({ url, group, toggles })
      }
      // 首页不在页面树里：侧栏里指向 / 的只有站名那一个链接
      const homeLinks = await page.locator('#nd-sidebar a[href="/"]').count()
      return {
        pass: outcomes.every(({ toggles }) => toggles >= 1) && homeLinks === 1,
        detail: `${outcomes.map(({ url, group, toggles }) => `${url}「${group}」${toggles} 个`).join('；')}；侧栏里指向首页的链接 ${homeLinks} 个（应只有站名）`,
      }
    })

    await check('在功能页面上侧栏停在最近看过的那一组（目录切换按钮与组里的页面不变）', async () => {
      await page.goto(`${baseUrl}/guide`, { waitUntil: 'load' })
      await waitForHydrated(page, `${sidebarRow} a[href="/comments"]`)
      const before = await page.locator('#nd-sidebar button', { hasText: '指南' }).count()
      await page.click(`${sidebarRow} a[href="/comments"]`)
      await page.locator('h1', { hasText: '全站评论' }).waitFor({ timeout: stepTimeoutMs })
      const dropdown = await page.locator('#nd-sidebar button', { hasText: '指南' }).count()
      const guidePage = await page.locator('#nd-sidebar a[href="/guide"]:visible').count()
      const hiddenShown = await page.locator('#nd-sidebar a:has([data-docsite-sidebar-hidden-page]):visible').count()
      return {
        pass: before >= 1 && dropdown >= 1 && guidePage >= 1 && hiddenShown === 0,
        detail: `/guide 上「指南」切换按钮 ${before} 个；到 /comments 后 ${dropdown} 个，组里的 /guide 显示 ${guidePage} 个，占位项显示 ${hiddenShown} 个`,
      }
    })

    await check('推送：一页 action 触发、另一页 EventSource 收到', async () => {
      const channelUrl = `/__docsite/feed/e2e-${mode}`
      const subscriber = await context.newPage()
      watchPage(subscriber, 'base feed-A', problems)
      await subscriber.goto(`${baseUrl}/`, { waitUntil: 'load' })
      await subscriber.evaluate(
        (url) =>
          new Promise((resolve) => {
            window.__feedMessages = []
            const source = new EventSource(url)
            source.addEventListener('message', (event) => window.__feedMessages.push(JSON.parse(event.data)))
            source.addEventListener('open', () => resolve())
          }),
        channelUrl,
      )
      const pusher = await context.newPage()
      watchPage(pusher, 'base feed-B', problems)
      await pusher.goto(`${baseUrl}/glossary-demo`, { waitUntil: 'load' })
      const status = await pusher.evaluate(
        async ({ url, token }) => (await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json', 'x-docsite-token': token }, body: JSON.stringify({ note: '推送一' }) })).status,
        { url: channelUrl, token: feedToken },
      )
      await subscriber.waitForFunction(() => window.__feedMessages.some((message) => message.note === '推送一'), null, { timeout: stepTimeoutMs })
      const latecomer = await context.newPage()
      watchPage(latecomer, 'base feed-C', problems)
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
        channelUrl,
      )
      const current = await (await fetch(`${baseUrl}${channelUrl}`)).json()
      const wrongToken = await fetch(`${baseUrl}${channelUrl}`, { method: 'POST', headers: { 'content-type': 'application/json', 'x-docsite-token': 'wrong' }, body: '{}' })
      await Promise.all([subscriber.close(), pusher.close(), latecomer.close()])
      const pass = status === 204 && first.note === '推送一' && current.note === '推送一' && wrongToken.status === 403
      return { pass, detail: `推 ${status}；后来的订阅者先收到 ${JSON.stringify(first)}；GET 当前值 ${JSON.stringify(current)}；令牌不对 ${wrongToken.status}` }
    })

    if (mode === 'dev') {
      await check('dev 新增内容文件：新地址能打开、已打开页面的侧栏出现它', async () => {
        await page.goto(`${baseUrl}/glossary-demo`, { waitUntil: 'load' })
        await waitForHydrated(page, '#nd-sidebar a[href="/glossary-demo"]')
        await markNoReload(page)
        const added = addedPageOf(siteDir, runTag)
        const addedAt = Date.now()
        writeFileSync(added.file, added.text)
        let status = 0
        let firstOkRequestMs = 0
        while (Date.now() - addedAt < stepTimeoutMs) {
          const requestStartedAt = Date.now()
          status = (await fetch(`${baseUrl}/${added.slug}`)).status
          firstOkRequestMs = Date.now() - requestStartedAt
          if (status === 200) break
          await new Promise((resolve) => setTimeout(resolve, 500))
        }
        const openedAfterMs = Date.now() - addedAt
        await page.locator(`#nd-sidebar a[href="/${added.slug}"]`).waitFor({ timeout: stepTimeoutMs })
        const sidebarAfterMs = Date.now() - addedAt
        const kept = await stillNoReload(page)
        const overlay = await hasViteErrorOverlay(page)
        return {
          pass: status === 200 && kept && !overlay && firstOkRequestMs < 5_000,
          detail: `新地址 ${status}（加文件后 ${openedAfterMs} ms 打开，那次请求 ${firstOkRequestMs} ms）；侧栏 ${sidebarAfterMs} ms 出现，没有整页刷新=${kept}，报错层=${overlay}`,
        }
      })

      await check('dev 改 TSX 页标题：侧栏与正文标题跟着变（不挂标题刷新插件）', async () => {
        const titlePage = titlePageOf(siteDir, runTag)
        await page.goto(`${baseUrl}/${titlePage.slug}`, { waitUntil: 'load' })
        await waitForHydrated(page, '[data-title-scratch-counter]')
        await markNoReload(page)
        const newTitle = `TSX 改过的标题 ${runTag}`
        writeFileSync(titlePage.file, readFileSync(titlePage.file, 'utf8').replace(/title: '[^']*'/, `title: '${newTitle}'`))
        const changedAt = Date.now()
        await page.locator(`#nd-sidebar a[href="/${titlePage.slug}"]`, { hasText: newTitle }).waitFor({ timeout: stepTimeoutMs })
        const sidebarMs = Date.now() - changedAt
        await page.locator('h1', { hasText: newTitle }).waitFor({ timeout: stepTimeoutMs })
        const kept = await stillNoReload(page)
        return { pass: true, detail: `侧栏 ${sidebarMs} ms 后是新标题，正文标题也换了，没有整页刷新=${kept}` }
      })
    } else {
      await check('浏览器产物里没有服务端代码', async () =>
        serverCodeInClientBuild(siteDir, ['node:fs', 'node:path', 'node:crypto', 'DOCSITE_FEED_TOKEN', 'DOCSITE_IDENTITY_CODE', '算不出可信 origin']),
      )
    }
  } finally {
    await context.close()
  }

  results.push(...problemResults(problems))
  return results
}
