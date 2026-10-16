import { checkRunner, openCommentsInbox, postFormToAction, problemResults, stepTimeoutMs, waitForHydrated, watchPage } from '../lib/checks.mjs'

/** 测试站里的样例报告：站点 reports/sample/，入口 include 十章，第一章第一节的 id 是下面这个 */
const sampleReport = { id: 'sample', title: '模块化控制器技术报告', revision: '版本  R0', date: '2026-10-10', chapterCount: 10, firstSectionId: 'sec_673f586878cb423eae1d0a329c54e27b' }
/** 报告页评论的归属键：报告页的地址 */
const sampleReportPage = `/reports/${sampleReport.id}`

/**
 * 打开报告页，直到收件箱里出现这串评论：不经页面直接写的评论，要等 dev 的文件监视把评论集合重新生成，loader 才读得到，
 * 在那之前打开的页面里没有它，隔一秒重开一次
 */
async function openReportUntilThreadShown(page, baseUrl, body) {
  const deadline = Date.now() + stepTimeoutMs
  for (;;) {
    await page.goto(`${baseUrl}${sampleReportPage}`, { waitUntil: 'load' })
    await openCommentsInbox(page)
    const shown = await page.locator('[data-comment-row]', { hasText: body }).waitFor({ timeout: 3_000 }).then(() => true, () => false)
    if (shown) return
    if (Date.now() > deadline) throw new Error(`报告页收件箱里一直没有「${body}」`)
    await page.waitForTimeout(1_000)
  }
}

/** dev：批第一章第一节写一串评论（正文带 runTag，跑完由 removeRunLeftovers 删掉），收件箱里有、那一节带标记、全站评论表里链到报告页 */
async function reportCommentWriteCheck({ page, baseUrl, runTag }) {
  const body = `e2e 报告评论 ${runTag}`
  const posted = await postFormToAction(baseUrl, '/comments.data', { intent: 'create-thread', page: sampleReportPage, anchor: sampleReport.firstSectionId, body })
  await openReportUntilThreadShown(page, baseUrl, body)
  const sectionMarked = await page.locator(`[id="${sampleReport.firstSectionId}"][data-commented-element]`).count()
  await page.goto(`${baseUrl}/comments`, { waitUntil: 'load' })
  const tableRow = page.locator('[data-comment-row]', { hasText: body })
  await tableRow.waitFor({ timeout: stepTimeoutMs })
  const tableLink = await tableRow.locator('a').first().getAttribute('href')
  return {
    pass: posted.status === 200 && sectionMarked === 1 && tableLink === sampleReportPage,
    detail: `提交 → ${posted.status}；第一章第一节带评论标记 ${sectionMarked} 处；全站评论表里那一行链到 ${tableLink}`,
  }
}

/** start：报告页的评论收件箱写明只读，直接提交被拒 */
async function reportCommentReadonlyCheck({ page, baseUrl, runTag }) {
  await page.goto(`${baseUrl}${sampleReportPage}`, { waitUntil: 'load' })
  await openCommentsInbox(page)
  const reason = page.locator('[data-readonly-reason]')
  await reason.waitFor({ timeout: stepTimeoutMs })
  const reasonText = ((await reason.textContent()) ?? '').trim()
  const posted = await postFormToAction(baseUrl, '/comments.data', { intent: 'create-thread', page: sampleReportPage, body: `e2e start 报告评论 ${runTag}` })
  return { pass: reasonText.includes('发布版') && posted.status === 403, detail: `收件箱写着「${reasonText}」；直接提交 → ${posted.status}` }
}

/** 报告（word-report）的检查：报告列表、整份报告一页（各章接在一起、右侧目录、公式、图片）、没有的报告 404，报告页的评论 dev 能写、start 只读 */
export async function runReportChecks({ browser, baseUrl, mode, runTag }) {
  const results = []
  const problems = []
  const check = checkRunner(results)
  const context = await browser.newContext({ viewport: { width: 1400, height: 900 } })
  try {
    const page = await context.newPage()
    watchPage(page, 'report', problems)

    await check('报告列表：样例报告一行，标题、版本、日期、章数，检查没有问题', async () => {
      await page.goto(`${baseUrl}/reports`, { waitUntil: 'load' })
      const row = page.locator(`[data-report-row="${sampleReport.id}"]`)
      await row.waitFor({ timeout: stepTimeoutMs })
      const cells = await row.locator('td').allTextContents()
      const expected = [sampleReport.title, sampleReport.revision, sampleReport.date, undefined, String(sampleReport.chapterCount), '没有问题']
      const pass = expected.every((text, index) => text === undefined || cells[index]?.trim() === text)
      return { pass, detail: `这一行：${cells.map((cell) => cell.trim()).join(' | ')}` }
    })

    await check('从列表站内导航到报告页：十章接成一页，右侧目录指向第一章第一节', async () => {
      await waitForHydrated(page, `[data-report-row="${sampleReport.id}"] a`)
      await page.click(`[data-report-row="${sampleReport.id}"] a`)
      await page.waitForURL(`${baseUrl}/reports/${sampleReport.id}`, { timeout: stepTimeoutMs })
      await page.locator('.report-document').waitFor({ timeout: stepTimeoutMs })
      const title = (await page.locator('h1').first().textContent())?.trim()
      const chapterHeadings = await page.locator('.report-document > section > h2').count()
      const tocLinks = await page.locator(`a[href="#${sampleReport.firstSectionId}"]`).evaluateAll((links) => links.filter((link) => !link.closest('.report-document')).length)
      const pass = title === sampleReport.title && chapterHeadings >= sampleReport.chapterCount && tocLinks > 0
      return { pass, detail: `标题「${title}」；正文顶层的章标题 ${chapterHeadings} 个（至少 ${sampleReport.chapterCount}）；正文外指向第一节的目录链接 ${tocLinks} 个` }
    })

    await check('报告页：公式用 KaTeX 画出来、图片地址都能取到', async () => {
      const formulas = await page.locator('.report-document .katex').count()
      const sources = await page.locator('.report-document img').evaluateAll((images) => images.map((image) => image.getAttribute('src')))
      const fetched = await Promise.all(sources.map(async (src) => {
        const response = await fetch(new URL(src, baseUrl))
        return `${src} → ${response.status} ${response.headers.get('content-type')}`
      }))
      const pass = formulas > 0 && sources.length > 0 && fetched.every((line) => line.endsWith('→ 200 image/png'))
      return { pass, detail: `公式 ${formulas} 个；图片 ${fetched.join('；') || '无'}` }
    })

    await check('没有的报告：404', async () => {
      const response = await fetch(`${baseUrl}/reports/no-such-report`)
      return { pass: response.status === 404, detail: `GET /reports/no-such-report → ${response.status}` }
    })

    if (mode === 'dev') await check('dev 报告页评论：批一节写一串，收件箱里有、那一节带标记，全站评论表里链到报告页', () => reportCommentWriteCheck({ page, baseUrl, runTag }))
    if (mode === 'start') await check('start 报告页评论：收件箱写明只读，直接提交被拒', () => reportCommentReadonlyCheck({ page, baseUrl, runTag }))
  } finally {
    await context.close()
  }
  results.push(...problemResults(problems))
  return results
}
