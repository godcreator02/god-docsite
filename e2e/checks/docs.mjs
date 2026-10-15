import { checkRunner, headingOf, markNoReload, problemResults, serverCodeInClientBuild, stepTimeoutMs, stillNoReload, waitForHydrated, watchPage } from '../lib/checks.mjs'

/** 页面上一处钉码外框：状态与里面代码块的文字 */
async function pinFramesOf(page) {
  return page.locator('.code-pin').evaluateAll((frames) => frames.map((frame) => ({ status: frame.getAttribute('data-pin-status'), dot: getComputedStyle(frame).getPropertyValue('--code-pin-dot').trim(), text: frame.textContent ?? '' })))
}

/** 文档维护三个功能（code-pin、explainer、trajectory）的检查：钉码外框、讲解组件、卡页、星轨盘页、侧栏入口与站内导航 */
export async function runDocsChecks({ browser, baseUrl, mode, siteDir }) {
  const results = []
  const problems = []
  const check = checkRunner(results)
  const context = await browser.newContext({ viewport: { width: 1400, height: 900 } })
  try {
    const page = await context.newPage()
    watchPage(page, 'docs', problems)

    await check('钉码外框与状态（code-pin 的 remark 插件与样式）', async () => {
      const response = await page.goto(`${baseUrl}/pinned`, { waitUntil: 'load' })
      const frames = await pinFramesOf(page)
      const [unconfirmed, missing] = frames
      const pass =
        response?.status() === 200 &&
        frames.length === 2 &&
        unconfirmed?.status === 'unconfirmed' &&
        unconfirmed.text.includes('export function greet') &&
        unconfirmed.dot === '#eab308' &&
        missing?.status === 'missing' &&
        missing.dot === '#ef4444'
      return { pass, detail: `GET /pinned → ${response?.status()}；外框 ${frames.map((frame) => `${frame.status}(${frame.dot})`).join('、')}` }
    })

    await check('讲解组件的样式经功能样式汇总生效（正文没有 import 样式）', async () => {
      const button = await page.locator('.dx-stepper .dx-btn-next').evaluate((element) => {
        const style = getComputedStyle(element)
        return { height: style.height, radius: style.borderTopLeftRadius }
      })
      return { pass: button.height === '28px' && button.radius === '8px', detail: `「下一步」按钮高 ${button.height}、圆角 ${button.radius}（explainer 的 .dx-btn 是 28px、8px）` }
    })

    await check('讲解组件水合（正文 import 的 Stepper）', async () => {
      await waitForHydrated(page, '.dx-stepper .dx-btn-next')
      const first = await page.locator('[data-e2e-docs-step]').textContent({ timeout: stepTimeoutMs })
      await page.click('.dx-stepper .dx-btn-next')
      await page.locator('[data-e2e-docs-step]', { hasText: '核对' }).waitFor({ timeout: stepTimeoutMs })
      return { pass: first === '写下钉码', detail: `第一步「${first}」，点「下一步」后到「核对」` }
    })

    await check('卡页：在整站布局里，卡里的公式与卡链接', async () => {
      const response = await page.goto(`${baseUrl}/trajectory/2026-01-02-second`, { waitUntil: 'load' })
      const heading = await headingOf(page)
      const sidebars = await page.locator('#nd-sidebar').count()
      const formulas = await page.locator('.katex').count()
      const cardLinks = await page.locator('a[href="/trajectory/2026-01-01-site-born"]').count()
      const pass = response?.status() === 200 && heading === '第二张卡' && sidebars === 1 && formulas > 0 && cardLinks > 0
      return { pass, detail: `→ ${response?.status()}，h1=${heading}，侧栏 ${sidebars} 个，公式 ${formulas} 处，指向起始卡的链接 ${cardLinks} 个` }
    })

    await check('卡页站内导航：点卡链接到另一张卡', async () => {
      await waitForHydrated(page, '.prose a[href="/trajectory/2026-01-01-site-born"]')
      await markNoReload(page)
      await page.click('.prose a[href="/trajectory/2026-01-01-site-born"]')
      await page.waitForURL(`${baseUrl}/trajectory/2026-01-01-site-born`, { timeout: stepTimeoutMs })
      await page.locator('h1', { hasText: '起始' }).waitFor({ timeout: stepTimeoutMs })
      const kept = await stillNoReload(page)
      return { pass: kept, detail: `到起始卡，没有整页刷新=${kept}` }
    })

    await check('侧栏星轨盘入口站内导航到星轨盘页（独立页面，不带侧栏）', async () => {
      await page.goto(`${baseUrl}/pinned`, { waitUntil: 'load' })
      await waitForHydrated(page, '#nd-sidebar a[href="/trajectory"]')
      await markNoReload(page)
      await page.click('#nd-sidebar a[href="/trajectory"]')
      await page.waitForURL(`${baseUrl}/trajectory`, { timeout: stepTimeoutMs })
      await page.locator('.star-disk').waitFor({ timeout: stepTimeoutMs })
      const sidebars = await page.locator('#nd-sidebar').count()
      const kept = await stillNoReload(page)
      return { pass: kept && sidebars === 0, detail: `点侧栏「星轨盘」，没有整页刷新=${kept}，侧栏 ${sidebars} 个` }
    })

    await check('星轨盘页直接打开：盘画出来、两张卡都在、顶栏回文档', async () => {
      const response = await page.goto(`${baseUrl}/trajectory`, { waitUntil: 'load' })
      await page.waitForFunction(() => document.querySelector('.star-canvas svg') !== null, null, { timeout: stepTimeoutMs })
      const sidebars = await page.locator('#nd-sidebar').count()
      const back = await page.locator('.trajectory-topbar a', { hasText: '← 文档' }).count()
      const labels = await page.locator('.star-canvas').textContent()
      const pass = response?.status() === 200 && sidebars === 0 && back === 1 && labels?.includes('第二张卡')
      return { pass, detail: `→ ${response?.status()}，侧栏 ${sidebars} 个，「← 文档」${back} 个，盘上有「第二张卡」=${labels?.includes('第二张卡')}` }
    })

    if (mode === 'start') {
      await check('浏览器产物里没有钉码与卡集合的服务端代码', async () => serverCodeInClientBuild(siteDir, ['node:child_process', 'createDiskPinner', 'cardSchema']))
    }
  } finally {
    await context.close()
  }
  results.push(...problemResults(problems))
  return results
}
