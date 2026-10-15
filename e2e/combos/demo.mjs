import { existsSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { chromium } from 'playwright'
import { checkRunner, filesUnder, headingOf, markNoReload, problemResults, stepTimeoutMs, stillNoReload, waitForHydrated, watchPage } from '../lib/checks.mjs'

const demoFeature = 'e2e-demo'
const featureDirOf = (siteDir) => path.join(siteDir, 'app', 'features', demoFeature)

/**
 * 建站后、装完依赖后加演示功能，再验 addFeature 重复运行：
 * 用户改过的文件不动、删掉的文件补回来、被改坏的汇总文件重写成原样
 */
export async function addDemoFeatureWithChecks({ siteDir, addFeature }) {
  const results = []
  const check = checkRunner(results)
  const indexFile = path.join(siteDir, 'app', 'features', 'routes.generated.ts')
  let firstIndexText = ''

  await check('addFeature：补进功能目录、重写汇总文件', async () => {
    const added = addFeature({ siteDir, packageName: demoFeature })
    firstIndexText = readFileSync(indexFile, 'utf8')
    const pass = added.feature === demoFeature && added.keptFiles.length === 0 && added.addedFiles.includes('routes.ts') && added.features.join() === `comments,${demoFeature}` && firstIndexText.includes(`./${demoFeature}/routes.ts`)
    return { pass, detail: `补进 ${added.addedFiles.join('、')}；功能 ${added.features.join('、')}` }
  })

  await check('addFeature 重复运行：改过的不动、删掉的补回、汇总文件重写', async () => {
    const editedFile = path.join(featureDirOf(siteDir), 'page.tsx')
    const editedText = `${readFileSync(editedFile, 'utf8')}// 用户改过这个文件\n`
    writeFileSync(editedFile, editedText)
    const removedFile = path.join(featureDirOf(siteDir), 'styles.css')
    rmSync(removedFile)
    writeFileSync(indexFile, '// 被改坏的汇总文件\n')
    const again = addFeature({ siteDir, packageName: demoFeature })
    const editedKept = readFileSync(editedFile, 'utf8') === editedText
    const removedBack = existsSync(removedFile)
    const indexRewritten = readFileSync(indexFile, 'utf8') === firstIndexText
    const pass = editedKept && removedBack && indexRewritten && again.addedFiles.join() === 'styles.css'
    return { pass, detail: `改过的保留=${editedKept}，删掉的补回=${removedBack}（这次补进 ${again.addedFiles.join('、')}），汇总文件重写成原样=${indexRewritten}` }
  })
  return results
}

/** 基础站 + 演示功能组合的检查：功能包模板约定的每一项 */
export async function runDemoChecks({ baseUrl, mode, siteDir, feedToken }) {
  const results = []
  const problems = []
  const check = checkRunner(results)
  // dev 与 start 用同一个站点目录：每轮从计数 0 开始。计数文件建站时就在（夹具），服务启动时 Tailwind 已经看得到它
  writeFileSync(path.join(siteDir, 'data', 'e2e-demo-counter.json'), '{"count":0}\n')
  const browser = await chromium.launch({ headless: true })
  try {
    const context = await browser.newContext({ viewport: { width: 1400, height: 900 } })
    const page = await context.newPage()
    watchPage(page, 'demo', problems)

    await check('演示页直接打开（loader）', async () => {
      const response = await page.goto(`${baseUrl}/e2e-demo`, { waitUntil: 'load' })
      const heading = await headingOf(page)
      const count = await page.locator('[data-e2e-demo-count]').textContent({ timeout: stepTimeoutMs })
      return { pass: response?.status() === 200 && heading === '演示功能页' && count === '0', detail: `GET /e2e-demo → ${response?.status()}，h1=${heading}，计数 ${count}` }
    })

    await check('样式生效（功能的 styles.css 进了 app.css）', async () => {
      const color = await page.locator('[data-e2e-demo-page]').evaluate((element) => getComputedStyle(element).color)
      return { pass: color === 'rgb(12, 34, 56)', detail: `演示页文字颜色 ${color}` }
    })

    await check('useFetcher 写入（action 写站点 data/，没有整页刷新）', async () => {
      await waitForHydrated(page, '[data-e2e-demo-increment]')
      await markNoReload(page)
      await page.click('[data-e2e-demo-increment]')
      await page.locator('[data-e2e-demo-count]', { hasText: '1' }).waitFor({ timeout: stepTimeoutMs })
      await page.locator('[data-e2e-demo-increment]:not([disabled])').waitFor({ timeout: stepTimeoutMs })
      await page.click('[data-e2e-demo-increment]')
      await page.locator('[data-e2e-demo-count]', { hasText: '2' }).waitFor({ timeout: stepTimeoutMs })
      // 写入后等一会儿再看：dev 下 Tailwind 扫到被写的文件会在写入之后才整页刷新
      await page.waitForTimeout(1_500)
      const stored = JSON.parse(readFileSync(path.join(siteDir, 'data', 'e2e-demo-counter.json'), 'utf8')).count
      const kept = await stillNoReload(page)
      return { pass: stored === 2 && kept, detail: `点两下，文件里 count=${stored}，没有整页刷新=${kept}` }
    })

    await check('布局顶部插槽有布局数据（layoutData 经 base 读身份、页面与推送通道）', async () => {
      const pushStatus = (
        await fetch(`${baseUrl}/__docsite/feed/e2e-demo`, {
          method: 'POST',
          headers: { 'content-type': 'application/json', 'x-docsite-token': feedToken, origin: baseUrl },
          body: JSON.stringify({ note: `顶栏推送 ${mode}` }),
        })
      ).status
      await page.goto(`${baseUrl}/e2e-demo`, { waitUntil: 'load' })
      const text = await page.locator('[data-e2e-demo-top]').textContent({ timeout: stepTimeoutMs })
      return { pass: pushStatus === 204 && new RegExp(`演示顶栏：测试员，共 \\d+ 页，推送 顶栏推送 ${mode}`).test(text ?? ''), detail: `推送 ${pushStatus}；${text}` }
    })

    await check('侧栏入口（页面树插件）站内导航到演示页', async () => {
      await page.goto(`${baseUrl}/`, { waitUntil: 'load' })
      await waitForHydrated(page, '#nd-sidebar a[href="/e2e-demo"]')
      await markNoReload(page)
      await page.click('#nd-sidebar a[href="/e2e-demo"]')
      await page.waitForURL(`${baseUrl}/e2e-demo`, { timeout: stepTimeoutMs })
      await page.locator('h1', { hasText: '演示功能页' }).waitFor({ timeout: stepTimeoutMs })
      const count = await page.locator('[data-e2e-demo-count]').textContent()
      const kept = await stillNoReload(page)
      return { pass: kept && count === '2', detail: `点侧栏「演示功能」，没有整页刷新=${kept}，计数 ${count}` }
    })

    await check('MDX 组件水合、remark 插件生效（内容页）', async () => {
      await page.goto(`${baseUrl}/e2e-demo-mdx`, { waitUntil: 'load' })
      await waitForHydrated(page, '[data-e2e-demo-counter]')
      await page.click('[data-e2e-demo-counter]')
      await page.click('[data-e2e-demo-counter]')
      await page.locator('[data-e2e-demo-counter]', { hasText: '演示计数：2' }).waitFor({ timeout: stepTimeoutMs })
      const marked = await page.locator('p[data-e2e-demo-remark]').count()
      return { pass: marked === 1, detail: `点两下计数为 2；带 data-e2e-demo-remark 的段落 ${marked} 个` }
    })

    await check('功能的集合页面能开（集合工厂并进了全站插件，含功能的 remark 插件）', async () => {
      const response = await page.goto(`${baseUrl}/e2e-demo/notes/hello`, { waitUntil: 'load' })
      const heading = await headingOf(page)
      const body = page.locator('[data-e2e-demo-note-body]')
      await body.waitFor({ timeout: stepTimeoutMs })
      const text = await body.textContent()
      const marked = await body.locator('p[data-e2e-demo-remark]').count()
      return { pass: response?.status() === 200 && heading === '演示笔记' && text?.includes('演示集合里的一条笔记') && marked === 1, detail: `→ ${response?.status()}，h1=${heading}，正文带标记的段落 ${marked} 个` }
    })

    await check('独立页面（standaloneRoutes）在整站布局之外、能水合', async () => {
      const response = await page.goto(`${baseUrl}/e2e-demo/full`, { waitUntil: 'load' })
      await waitForHydrated(page, '[data-e2e-demo-full-counter]')
      await page.click('[data-e2e-demo-full-counter]')
      await page.locator('[data-e2e-demo-full-counter]', { hasText: '独立页计数：1' }).waitFor({ timeout: stepTimeoutMs })
      const sidebars = await page.locator('#nd-sidebar').count()
      const tops = await page.locator('[data-e2e-demo-top]').count()
      return { pass: response?.status() === 200 && sidebars === 0 && tops === 0, detail: `→ ${response?.status()}，侧栏 ${sidebars} 个、布局顶栏 ${tops} 个，点一下计数为 1` }
    })

    if (mode === 'start') {
      await check('浏览器产物里没有功能的服务端代码', async () => {
        const clientFiles = filesUnder(path.join(siteDir, 'build', 'client')).filter((file) => file.endsWith('.js'))
        const serverOnlyMarkers = ['node:fs', 'e2e-demo-counter.json', 'demo.server']
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
