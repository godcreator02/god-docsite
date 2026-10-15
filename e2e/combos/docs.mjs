import { cpSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { chromium } from 'playwright'
import { checkRunner, filesUnder, headingOf, markNoReload, problemResults, stepTimeoutMs, stillNoReload, waitForHydrated, watchPage } from '../lib/checks.mjs'

/** 文档维护组合：基础站 + 这三个功能包（包名 → 仓里的目录），命令行 docfirst 的起始物叠在站点根上 */
export const docsFeaturePackages = {
  '@godcreator/code-pin': 'packages/code-pin',
  '@godcreator/trajectory': 'packages/trajectory',
  '@godcreator/explainer': 'packages/explainer',
}

const toPosix = (file) => file.replaceAll('\\', '/')

/**
 * createSite 之后：叠上 docfirst 的模板（配置、生成物正本、起始页、根卡）与本组合的夹具（钉码页、第二张卡、被钉的代码），
 * 三个功能包写进依赖。specifiers 是包名 → link: / file: 依赖说明，和 createSite 的装法一致
 */
export function prepareDocsSite({ siteDir, repoDir, specifiers }) {
  cpSync(path.join(repoDir, 'packages', 'docfirst', 'template'), siteDir, { recursive: true })
  cpSync(path.join(repoDir, 'e2e', 'fixtures', 'docs-site'), siteDir, { recursive: true })
  const packageJsonFile = path.join(siteDir, 'package.json')
  const packageJson = JSON.parse(readFileSync(packageJsonFile, 'utf8'))
  for (const name of Object.keys(docsFeaturePackages)) {
    const specifier = specifiers[name]
    if (specifier === undefined) throw new Error(`没给 ${name} 的依赖说明`)
    packageJson.dependencies[name] = toPosix(specifier)
  }
  writeFileSync(packageJsonFile, `${JSON.stringify(packageJson, null, 2)}\n`)
}

/** 装完依赖后对三个功能包各运行一次 addFeature */
export async function addDocsFeaturesWithChecks({ siteDir, addFeature }) {
  const results = []
  const check = checkRunner(results)
  await check('addFeature：code-pin、trajectory、explainer 补进功能目录', async () => {
    const added = Object.keys(docsFeaturePackages).map((packageName) => addFeature({ siteDir, packageName }))
    const featuresDir = path.join(siteDir, 'app', 'features')
    const dirs = readdirSync(featuresDir, { withFileTypes: true }).filter((entry) => entry.isDirectory()).map((entry) => entry.name).sort()
    const routesIndex = readFileSync(path.join(featuresDir, 'routes.generated.ts'), 'utf8')
    const collectionsIndex = readFileSync(path.join(featuresDir, 'collections.generated.ts'), 'utf8')
    const stylesIndex = readFileSync(path.join(featuresDir, 'styles.generated.css'), 'utf8')
    const pass =
      dirs.join() === 'code-pin,explainer,trajectory' &&
      added.at(-1).features.join() === 'code-pin,explainer,trajectory' &&
      routesIndex.includes('./trajectory/routes.ts') &&
      collectionsIndex.includes('export const trajectory =') &&
      stylesIndex.includes("@import './explainer/styles.css';")
    return { pass, detail: `功能目录 ${dirs.join('、')}；汇总认出的功能 ${added.at(-1).features.join('、')}` }
  })
  return results
}

/** 页面上一处钉码外框：状态与里面代码块的文字 */
async function pinFramesOf(page) {
  return page.locator('.code-pin').evaluateAll((frames) => frames.map((frame) => ({ status: frame.getAttribute('data-pin-status'), dot: getComputedStyle(frame).getPropertyValue('--code-pin-dot').trim(), text: frame.textContent ?? '' })))
}

/** 文档维护组合的检查：钉码外框、讲解组件、卡页、星轨盘页、侧栏入口与站内导航 */
export async function runDocsChecks({ baseUrl, mode, siteDir }) {
  const results = []
  const problems = []
  const check = checkRunner(results)
  const browser = await chromium.launch({ headless: true })
  try {
    const context = await browser.newContext({ viewport: { width: 1400, height: 900 } })
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
      await check('浏览器产物里没有钉码与卡集合的服务端代码', async () => {
        const clientFiles = filesUnder(path.join(siteDir, 'build', 'client')).filter((file) => file.endsWith('.js'))
        const serverOnlyMarkers = ['node:child_process', 'createDiskPinner', 'cardSchema']
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
