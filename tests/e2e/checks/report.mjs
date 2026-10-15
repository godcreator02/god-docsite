import { checkRunner, problemResults, stepTimeoutMs, waitForHydrated, watchPage } from '../lib/checks.mjs'

/** 测试站里的样例报告：站点 reports/sample/，入口 include 十章，第一章第一节的 id 是下面这个 */
const sampleReport = { id: 'sample', title: '模块化控制器技术报告', revision: '版本  R0', date: '2026-10-10', chapterCount: 10, firstSectionId: 'sec_673f586878cb423eae1d0a329c54e27b' }

/** 报告（word-report）的检查：报告列表、整份报告一页（各章接在一起、右侧目录、公式、图片）、没有的报告 404。dev 与 start 一样，报告只读 */
export async function runReportChecks({ browser, baseUrl }) {
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
  } finally {
    await context.close()
  }
  results.push(...problemResults(problems))
  return results
}
