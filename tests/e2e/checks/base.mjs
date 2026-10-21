import { existsSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { avatarContentType, avatarFileInSite, avatarMaxBytes, avatarSize, avatarWriteUrl, webpDimensionsOf } from '../../../packages/identity/dist/core/index.mjs'
import { checkRunner, filesUnder, hasViteErrorOverlay, headingOf, markNoReload, openCommentsInbox, postFormToAction, problemResults, serverCodeInClientBuild, stepTimeoutMs, stillNoReload, waitForHydrated, watchPage, writeThreadAndReply } from '../lib/checks.mjs'
import { addedPageOf, strayContentFileOf, titlePageOf } from '../lib/run-scratch.mjs'
import { testerPersonId } from '../lib/site.mjs'

/** 侧栏站名下的一横排：搜索按钮与功能入口（god-docsite 的 SidebarLinksRow） */
const sidebarRow = '#nd-sidebar [data-docsite-sidebar-row]'

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

/** 上传用的图：300×200 的 SVG，红底中间一个黄圆；居中裁成正方形以后四角是红的、中心是黄的 */
const avatarSourceSvg =
  '<svg xmlns="http://www.w3.org/2000/svg" width="300" height="200"><rect width="300" height="200" fill="#dc2626"/><circle cx="150" cy="100" r="80" fill="#facc15"/></svg>'

/** 头像在页面上画成的 img：src 以这个人的头像地址开头 */
const avatarImageOf = (personId) => `img.dc-avatar[src^="/avatars/${personId}.webp?v="]`

/** 上传以后本页各处的头像：刚传那张图的本地地址 */
const uploadedImage = 'img.dc-avatar[src^="blob:"]'

/** 服务端给出的头像：dev 服务认出 public/ 里的新文件要几十毫秒，按条件等它回 200（这个请求不经浏览器，不进控制台记录） */
async function servedAvatarOf(baseUrl, personId) {
  const deadline = Date.now() + stepTimeoutMs
  for (;;) {
    const response = await fetch(`${baseUrl}/avatars/${personId}.webp`)
    if (response.status === 200 || Date.now() > deadline) return { status: response.status, contentType: response.headers.get('content-type') }
    await new Promise((resolve) => setTimeout(resolve, 50))
  }
}

/** 浏览器里把头像图画到画布上，取左上角与中心两个点的颜色 */
async function avatarPixelsOf(page, src) {
  return page.evaluate(async (url) => {
    const image = new Image()
    image.src = url
    await image.decode()
    const canvas = document.createElement('canvas')
    canvas.width = image.naturalWidth
    canvas.height = image.naturalHeight
    const context = canvas.getContext('2d', { willReadFrequently: true })
    context.drawImage(image, 0, 0)
    const pixel = (x, y) => [...context.getImageData(x, y, 1, 1).data.slice(0, 3)]
    return { width: image.naturalWidth, height: image.naturalHeight, corner: pixel(4, 4), center: pixel(64, 64) }
  }, src)
}

const isRed = ([r, g, b]) => r > 180 && g < 80 && b < 80
const isYellow = ([r, g, b]) => r > 200 && g > 160 && b < 90

/** 在站点自己的页面里直接往头像写入路由 PUT（带着站点的 Origin）：故意被拒，用不记控制台的单独页面，免得「无 4xx」那一项把它算成问题 */
async function avatarPutFromPage(page, baseUrl, body) {
  const probe = await page.context().newPage()
  try {
    await probe.goto(`${baseUrl}/about`, { waitUntil: 'load' })
    return await probe.evaluate(
      async ({ url, contentType, bytes }) => {
        const response = await fetch(url, { method: 'PUT', headers: { 'content-type': contentType }, body: new Uint8Array(bytes) })
        return { status: response.status, text: await response.text() }
      },
      { url: avatarWriteUrl, contentType: avatarContentType, bytes: body },
    )
  } finally {
    await probe.close()
  }
}

/**
 * dev 下换一次测试员的头像再改回首字。头像文件名是人员 id、不带运行编号：跑之前它在就不动它、直接失败；
 * 这一项自己新建的文件与文件夹在结束时删掉（不管过没过），跑完 git status 照旧
 */
async function checkAvatarUpload({ page, baseUrl, siteDir, runTag }) {
  const avatarFile = path.join(siteDir, avatarFileInSite(testerPersonId))
  const createdDirs = ['public', path.join('public', 'avatars')].map((relative) => path.join(siteDir, relative)).filter((dir) => !existsSync(dir))
  if (existsSync(avatarFile)) throw new Error(`${avatarFile} 已经在了：e2e 不覆盖仓里的头像，先挪走它`)
  try {
    await page.goto(`${baseUrl}/writing/collapse-test`, { waitUntil: 'load' })
    await page.waitForLoadState('networkidle')
    await waitForHydrated(page, '[data-identity-badge]')
    await page.click('[data-identity-badge]')
    await page.locator('[data-avatar-panel]').waitFor({ timeout: stepTimeoutMs })
    await page.setInputFiles('[data-avatar-file]', { name: `e2e-avatar-${runTag}.svg`, mimeType: 'image/svg+xml', buffer: Buffer.from(avatarSourceSvg) })
    // 本页先显示刚传的那张（blob: 本地地址），换页以后才用服务端的 /avatars/<id>.webp?v=…
    const badgeImage = page.locator(`[data-identity-badge] ${uploadedImage}`)
    await badgeImage.waitFor({ timeout: stepTimeoutMs })
    const bytes = new Uint8Array(readFileSync(avatarFile))
    const stored = webpDimensionsOf(bytes)
    const served = await servedAvatarOf(baseUrl, testerPersonId)
    const pixels = await avatarPixelsOf(page, await badgeImage.getAttribute('src'))
    await page.keyboard.press('Escape')

    await openCommentsInbox(page)
    const inboxImages = await page.locator(`[data-comments-inbox] ${uploadedImage}`).count()
    await page.goto(`${baseUrl}/`, { waitUntil: 'load' })
    const memberImages = await page.locator('main section', { has: page.locator('h2', { hasText: '成员' }) }).locator(avatarImageOf(testerPersonId)).count()
    await page.goto(`${baseUrl}/tasks`, { waitUntil: 'load' })
    const taskPageImages = await page.locator(`main ${avatarImageOf(testerPersonId)}`).count()

    const modifiedBefore = statSync(avatarFile).mtimeMs
    const rejectedInPage = await avatarPutFromPage(page, baseUrl, [82, 73, 70, 70, 0, 0, 0, 0])
    const rejectedForeign = await fetch(`${baseUrl}${avatarWriteUrl}`, { method: 'PUT', headers: { 'content-type': avatarContentType }, body: bytes })
    const unchanged = statSync(avatarFile).mtimeMs === modifiedBefore

    await page.goto(`${baseUrl}/about`, { waitUntil: 'load' })
    await page.waitForLoadState('networkidle')
    await waitForHydrated(page, '[data-identity-badge]')
    await page.click('[data-identity-badge]')
    await page.click('[data-avatar-remove]')
    await page.locator(`[data-identity-badge] span.dc-avatar`).waitFor({ timeout: stepTimeoutMs })
    const removed = !existsSync(avatarFile)
    await page.keyboard.press('Escape')

    const pass =
      stored.width === avatarSize &&
      stored.height === avatarSize &&
      bytes.length <= avatarMaxBytes &&
      served.status === 200 &&
      served.contentType === avatarContentType &&
      isRed(pixels.corner) &&
      isYellow(pixels.center) &&
      inboxImages >= 1 &&
      memberImages === 1 &&
      taskPageImages >= 1 &&
      rejectedInPage.status === 400 &&
      rejectedForeign.status === 403 &&
      unchanged &&
      removed
    return {
      pass,
      detail:
        `存下 ${stored.width}×${stored.height}、${(bytes.length / 1024).toFixed(1)} KB，/avatars/${testerPersonId}.webp → ${served.status} ${served.contentType}；左上角 rgb(${pixels.corner}) 中心 rgb(${pixels.center})；` +
        `收件箱里 ${inboxImages} 张、首页成员里 ${memberImages} 张、任务页 ${taskPageImages} 张；不是 webp → ${rejectedInPage.status}（${rejectedInPage.text.trim()}），不带 Origin → ${rejectedForeign.status}，文件${unchanged ? '没变' : '变了'}；改回首字后文件${removed ? '删掉了' : '还在'}`,
    }
  } finally {
    rmSync(avatarFile, { force: true })
    for (const dir of createdDirs.reverse()) if (existsSync(dir) && readdirSync(dir).length === 0) rmSync(dir, { recursive: true })
  }
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
        pass: response?.status() === 200 && heading === '全功能测试站' && sidebars === 0 && missingNav.length === 0 && missingSections.length === 0 && recordLinks > 0,
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

    await check('侧栏站内导航（这一页的同名文件夹里有 json 附件，不被当成目录说明，这一页仍在侧栏里）', async () => {
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

    await check('没有的地址：404 页写明地址，点「回首页」回到首页', async () => {
      // 故意打开 404：用不记控制台的单独页面，免得「控制台无 4xx」那一项把它算成问题
      const missingPage = await context.newPage()
      try {
        const missingPath = `/e2e-missing-${runTag}`
        const response = await missingPage.goto(`${baseUrl}${missingPath}`, { waitUntil: 'load' })
        const heading = await headingOf(missingPage)
        const showsPath = ((await missingPage.locator('main').textContent()) ?? '').includes(missingPath)
        await missingPage.getByRole('link', { name: '回首页', exact: true }).click()
        const siteName = JSON.parse(readFileSync(path.join(siteDir, 'content', 'meta.json'), 'utf8')).title
        await missingPage.locator('h1', { hasText: siteName }).waitFor({ timeout: stepTimeoutMs })
        return { pass: response?.status() === 404 && heading === '没有这一页' && showsPath, detail: `→ ${response?.status()}，h1=${heading}，写着地址=${showsPath}；点「回首页」后回到首页（h1=${siteName}）` }
      } finally {
        await missingPage.close()
      }
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

    await check('TSX 页的 ImageZoom：点图在页内放大，放大的是 zoomSrc 给的高清图', async () => {
      await page.goto(`${baseUrl}/tsx-demo`, { waitUntil: 'load' })
      await waitForHydrated(page, '[data-tsx-counter]')
      const pageImage = page.locator('[data-tsx-zoom-image]')
      const pageSrc = await pageImage.getAttribute('src')
      await pageImage.click()
      // 弹层先放页面上那张，高清图加载完才换上；小 SVG 会被 Vite 内联成 data 地址、看不出文件名，所以等它变得和页面上那张不同
      const zoomedSrc = await page
        .waitForFunction(
          (smallSrc) => {
            const src = document.querySelector('dialog[open] img[data-rmiz-modal-img]')?.getAttribute('src')
            return src && src !== smallSrc ? src : null
          },
          pageSrc,
          { timeout: stepTimeoutMs },
        )
        .then((handle) => handle.jsonValue())
      await page.keyboard.press('Escape')
      return { pass: Boolean(pageSrc), detail: `放大后换成了另一张图（${zoomedSrc.length} 个字符的地址）` }
    })

    if (mode === 'dev') {
      await check('批注模式下点单放的按钮（dev）：批的是这个按钮，按钮不被按下；退出批注后照常能按', async () => {
        await page.goto(`${baseUrl}/tsx-demo`, { waitUntil: 'load' })
        await waitForHydrated(page, '[data-tsx-counter]')
        const counter = page.locator('[data-tsx-counter]')
        await page.click('[data-comment-picking-toggle]')
        await counter.click()
        await page.locator('[data-comment-draft-form]').waitFor({ timeout: stepTimeoutMs })
        const draftOnCounter = await counter.evaluate((element) => element.hasAttribute('data-comment-draft-target'))
        const countWhilePicking = await counter.textContent()
        await page.keyboard.press('Escape')
        await counter.click()
        await page.waitForFunction(() => document.querySelector('[data-tsx-counter]')?.textContent === '1', null, { timeout: stepTimeoutMs })
        return { pass: draftOnCounter && countWhilePicking === '0', detail: `草稿批在按钮上 ${draftOnCounter}，批注时计数 ${countWhilePicking}，退出后点一下变 1` }
      })
    }

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

      await check('地址点名一串就打开它（dev）：通知里的评论链接 ?comment=<串 id>，打开页面时这一串浮在正文上，不用在收件箱里点', async () => {
        await page.goto(`${baseUrl}/writing/collapse-test`, { waitUntil: 'load' })
        await page.waitForLoadState('networkidle')
        await openCommentsInbox(page)
        const row = page.locator('[data-comment-row]', { hasText: `e2e 评论 ${runTag}` })
        await row.waitFor({ timeout: stepTimeoutMs })
        const threadId = await row.getAttribute('data-comment-row')
        await page.goto(`${baseUrl}/writing/collapse-test?comment=${threadId}`, { waitUntil: 'load' })
        const card = page.locator(`[data-comments-layer] [data-comment-card="${threadId}"]`)
        const shown = await card.waitFor({ timeout: stepTimeoutMs }).then(() => true, () => false)
        return { pass: shown, detail: `串 ${threadId} ${shown ? '' : '没有'}浮在正文上` }
      })

      await check('批注一块（dev）：草稿与这一串浮在那一块正下方、不挤动正文；写草稿时正文栏外是蓝条，发出以后是一道和那一块上下对齐的黄条，打开时加粗，那一块始终不铺底色；点那一块收起浮窗、不打开评论，点黄条才打开，收件箱不跟着收', async () => {
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
        const draftBar = await page.locator('[data-comment-margin-bar-draft]').evaluate((element, blockTop) => {
          const rect = element.getBoundingClientRect()
          return { topGap: Math.abs(rect.top + window.scrollY - blockTop), outside: rect.right <= document.querySelector('[data-comment-scope]').getBoundingClientRect().left }
        }, await documentTopOf(block))
        const draftBackground = await block.evaluate((element) => getComputedStyle(element).backgroundColor)
        await page.fill('[data-comment-draft-form] textarea[name="body"]', commentText)
        await page.click('[data-comment-draft-form] button[type="submit"]')
        const card = page.locator('[data-comments-layer] [data-comment-card]', { hasText: commentText })
        await card.waitFor({ timeout: stepTimeoutMs })
        const blockBottom = await block.evaluate((element) => element.getBoundingClientRect().bottom + window.scrollY)
        const layerTop = await card.evaluate((element) => element.closest('[data-comments-layer]').getBoundingClientRect().top + window.scrollY)
        const nextTopAfter = await documentTopOf(paragraphs.nth(1))
        const marked = await block.getAttribute('data-commented-element')
        const threadId = await block.getAttribute('data-comment-thread')
        const bar = page.locator(`[data-comment-margin-bar="${threadId}"]`)
        const barFit = await bar.evaluate((element) => {
          const barRect = element.getBoundingClientRect()
          const blockRect = document.querySelector(`[data-comment-thread="${element.getAttribute('data-comment-margin-bar')}"]`).getBoundingClientRect()
          const scopeLeft = document.querySelector('[data-comment-scope]').getBoundingClientRect().left
          return { topGap: Math.abs(barRect.top - blockRect.top), heightGap: Math.abs(barRect.height - blockRect.height), outside: barRect.right <= scopeLeft, width: barRect.width, active: element.hasAttribute('data-active') }
        })
        const blockBackground = await block.evaluate((element) => getComputedStyle(element).backgroundColor)
        await block.click()
        await card.waitFor({ state: 'detached', timeout: stepTimeoutMs })
        const barActiveAfterClose = await bar.evaluate((element) => element.hasAttribute('data-active'))
        await block.click()
        await page.waitForTimeout(300)
        const openedByBlock = await card.count()
        await bar.click()
        await card.waitFor({ timeout: stepTimeoutMs })
        await bar.click()
        await card.waitFor({ state: 'detached', timeout: stepTimeoutMs })
        const inboxes = await page.locator('[data-comments-inbox]').count()
        const below = layerTop > blockBottom && layerTop - blockBottom < 24
        const barAligned = barFit.topGap < 1 && barFit.heightGap < 1 && barFit.outside && barFit.active && !barActiveAfterClose
        const transparent = (color) => color === 'rgba(0, 0, 0, 0)' || color === 'transparent'
        const noFill = transparent(blockBackground) && transparent(draftBackground)
        const draftBarAligned = draftBar.topGap < 1 && draftBar.outside
        return {
          pass: below && nextTopAfter === nextTopBefore && marked === 'active' && barAligned && draftBarAligned && noFill && openedByBlock === 0 && inboxes === 1,
          detail:
            `写草稿时那一块底色 ${draftBackground}、蓝条和它顶边差 ${draftBar.topGap.toFixed(1)}px、在正文栏外 ${draftBar.outside}；浮窗顶边比那一块底边低 ${Math.round(layerTop - blockBottom)}px；下一段的位置 ${nextTopBefore} → ${nextTopAfter}；那一块标成 ${marked}、底色 ${blockBackground}；` +
            `黄条和那一块顶边差 ${barFit.topGap.toFixed(1)}px、高度差 ${barFit.heightGap.toFixed(1)}px、在正文栏外 ${barFit.outside}、宽 ${barFit.width}px、打开时加粗 ${barFit.active}、收起后 ${barActiveAfterClose ? '还加粗' : '变回'}；点那一块收起浮窗，再点那一块打开了 ${openedByBlock} 串，点黄条打开、再点收起；收件箱 ${inboxes} 个`,
        }
      })

      await check('复制给 AI（dev）：点开批了一块的那一串，「复制给 AI」复制的提示词写着站点地址、页面、串 id、打开这一串的链接与那一块的文字', async () => {
        const commentText = `e2e 批一块 ${runTag}`
        await page.goto(`${baseUrl}/writing/collapse-test`, { waitUntil: 'load' })
        await page.waitForLoadState('networkidle')
        await openCommentsInbox(page)
        const row = page.locator('[data-comment-row]', { hasText: commentText })
        await row.waitFor({ timeout: stepTimeoutMs })
        const threadId = await row.getAttribute('data-comment-row')
        const card = await openThreadFromInbox(page, threadId)
        const blockText = ((await page.locator(`[data-comment-thread="${threadId}"]`).textContent()) ?? '').trim()
        // 剪贴板换成记下写入的内容：无头浏览器里不用申请剪贴板权限
        await page.evaluate(() => {
          window.__copiedForAi = []
          Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: async (text) => void window.__copiedForAi.push(text) } })
        })
        await card.locator('[data-thread-ai] button').click()
        await card.locator('[data-thread-ai]', { hasText: '已复制' }).waitFor({ timeout: stepTimeoutMs })
        const [prompt = ''] = await page.evaluate(() => window.__copiedForAi)
        const expected = [`站点地址：${baseUrl}/`, '页面：writing/collapse-test.mdx', `评论串：${threadId}`, `${baseUrl}/writing/collapse-test?comment=${threadId}`, `> ${blockText.split('\n')[0]}`, 'docsite.comment.reply']
        const missing = expected.filter((text) => !prompt.includes(text))
        return { pass: blockText !== '' && missing.length === 0, detail: missing.length === 0 ? `串 ${threadId} 复制了 ${prompt.length} 字的提示词，带着那一块的文字` : `提示词里缺：${missing.join('；')}\n${prompt}` }
      })

      await check('换头像（dev）：侧栏底部点开身份标记，选一张 300×200 的 SVG，浏览器居中裁成 128×128 的 webp 存进 public/avatars/<本人>.webp；侧栏、评论收件箱、项目首页成员都换成这张图；不合格的图与外来请求被拒；改回首字删掉文件', async () =>
        checkAvatarUpload({ page, baseUrl, siteDir, runTag }),
      )
    } else {
      await check('start 只读：侧栏底部是「只读」、没有头像面板；直接上传头像被拒，不写文件', async () => {
        const avatarFile = path.join(siteDir, avatarFileInSite(testerPersonId))
        const existedBefore = existsSync(avatarFile)
        await page.goto(`${baseUrl}/about`, { waitUntil: 'load' })
        await waitForHydrated(page, `${sidebarRow} a[href="/comments"]`)
        const badges = await page.locator('[data-identity-badge]').count()
        const readonlyText = ((await page.locator('#nd-sidebar .dc-identity-readonly').textContent()) ?? '').trim()
        const rejected = await avatarPutFromPage(page, baseUrl, [82, 73, 70, 70])
        const pass = badges === 0 && readonlyText === '只读' && rejected.status === 403 && existsSync(avatarFile) === existedBefore
        return { pass, detail: `身份标记按钮 ${badges} 个，侧栏底部写着「${readonlyText}」；直接上传 → ${rejected.status}，${avatarFileInSite(testerPersonId)} ${existsSync(avatarFile) === existedBefore ? '没变' : '变了'}` }
      })

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
        const copyForAi = await card.locator('[data-thread-ai]').count()
        const rejected = await postFormToAction(baseUrl, '/comments.data', { intent: 'resolve-thread', threadId })
        const unchanged = readFileSync(presetHead, 'utf8') === before
        return {
          pass: statusToggles === 0 && copyForAi === 0 && rejected.status === 403 && unchanged,
          detail: `点开的那串里状态按钮 ${statusToggles} 个、「复制给 AI」${copyForAi} 个；直接提交 → ${rejected.status}；预置串 ${threadId} 的串头${unchanged ? '没变' : '变了'}`,
        }
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
        { url: '/about', group: '全功能测试站' },
        { url: '/writing/collapse-test', group: '全功能测试站' },
        { url: '/guide', group: '指南' },
        { url: '/tasks', group: '全功能测试站' },
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

      await check('dev 频道 open-page：带应用窗口标记打开的标签页去掉标记、跟着换页，没带标记的不动', async () => {
        const appWindow = await context.newPage()
        watchPage(appWindow, 'base', problems)
        try {
          await appWindow.goto(`${baseUrl}/glossary-demo?docsite-app-window=1`, { waitUntil: 'load' })
          await waitForHydrated(appWindow, '#nd-sidebar a[href="/glossary-demo"]')
          await appWindow.waitForURL(`${baseUrl}/glossary-demo`, { timeout: stepTimeoutMs })
          await page.goto(`${baseUrl}/glossary-demo`, { waitUntil: 'load' })
          await waitForHydrated(page, '#nd-sidebar a[href="/glossary-demo"]')
          // 两个标签页的推送连接都连上以后再推：连上时先收到的旧请求不算
          await new Promise((resolve) => setTimeout(resolve, 1_000))
          const response = await fetch(`${baseUrl}/__docsite/feed/open-page`, {
            method: 'POST',
            headers: { 'content-type': 'application/json', 'x-docsite-token': feedToken },
            body: JSON.stringify({ path: '/writing/collapse-test', at: Date.now() }),
          })
          await appWindow.locator('h1', { hasText: '收起内容试验' }).waitFor({ timeout: stepTimeoutMs })
          const otherStayed = new URL(page.url()).pathname === '/glossary-demo'
          const badShape = await fetch(`${baseUrl}/__docsite/feed/open-page`, { method: 'POST', headers: { 'content-type': 'application/json', 'x-docsite-token': feedToken }, body: '{"path":"nowhere"}' })
          return {
            pass: response.status === 204 && otherStayed && badShape.status === 400,
            detail: `推 ${response.status}；应用窗口换到了 ${new URL(appWindow.url()).pathname}，没带标记的标签页还在 ${new URL(page.url()).pathname}；形状不对 ${badShape.status}`,
          }
        } finally {
          await appWindow.close()
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

      await check('dev 内容目录放错文件：顶上正中那一行最前面出现问题按钮、点开的列表在按钮下方，列着那个文件，不弹报错层；删掉后按钮消失，没有整页刷新', async () => {
        await page.goto(`${baseUrl}/glossary-demo`, { waitUntil: 'load' })
        await waitForHydrated(page, '#nd-sidebar a[href="/glossary-demo"]')
        await markNoReload(page)
        const stray = strayContentFileOf(siteDir, runTag)
        writeFileSync(stray.file, stray.text)
        const issuesButton = page.locator('[data-top-notices] > [data-dev-issues]:first-child > button', { hasText: '个问题' })
        await issuesButton.waitFor({ timeout: stepTimeoutMs })
        await issuesButton.click()
        const issueRow = page.locator('[data-dev-issue-group="content-layout"] summary', { hasText: stray.name })
        await issueRow.waitFor({ timeout: stepTimeoutMs })
        const buttonBox = await issuesButton.boundingBox()
        const panelBox = await page.locator('section[aria-label="开发服务报出的问题"]').boundingBox()
        const atTop = buttonBox !== null && buttonBox.y < 40 && panelBox !== null && panelBox.y >= buttonBox.y + buttonBox.height
        const overlay = await hasViteErrorOverlay(page)
        rmSync(stray.file)
        await page.locator('[data-dev-issues]').waitFor({ state: 'detached', timeout: stepTimeoutMs })
        const kept = await stillNoReload(page)
        return {
          pass: atTop && !overlay && kept,
          detail: `问题按钮在顶上（y=${buttonBox?.y}），列表在它下方（y=${panelBox?.y}），列着 ${stray.name}，报错层=${overlay}；删掉后按钮消失，没有整页刷新=${kept}`,
        }
      })
    } else {
      await check('浏览器产物里没有服务端代码', async () =>
        serverCodeInClientBuild(siteDir, ['node:fs', 'node:path', 'node:crypto', 'DOCSITE_FEED_TOKEN', '算不出可信 origin']),
      )
    }
  } finally {
    await context.close()
  }

  results.push(...problemResults(problems))
  return results
}
