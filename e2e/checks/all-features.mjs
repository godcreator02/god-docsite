import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { checkRunner, problemResults, waitForHydrated, watchPage } from '../lib/checks.mjs'

/*
 * 全部功能装在同一个站带来的检查：各功能的侧栏入口、路由、样式彼此不挤掉。
 * 单个功能自己的行为在 base、collab、docs 三组里查
 */

/** 侧栏里功能的入口，按功能名排序后各功能 sidebarLinks 的先后（collab、comments、trajectory） */
const featureSidebarEntries = ['/tasks', '/calendar', '/comments', '/trajectory']

/** 功能的下级页面与侧栏上应当高亮的入口：入口按地址前缀高亮 */
const highlightedEntryOf = [
  { url: '/calendar/2026-10-12', entry: '/calendar' },
  { url: '/tasks/20261012091000-adapt01', entry: '/tasks' },
  { url: '/trajectory/2026-01-02-second', entry: '/trajectory' },
  { url: '/calendar', entry: '/calendar' },
]

/**
 * 各地址与只有接住它的那条路由才渲染得出的字样（服务端渲染的 HTML 里）：被内容页的 * 路由或别的功能的路由接住就看不到它。
 * 字样要不出现在普通内容页 controlUrl 上，检查里一并核对，免得字样本身就到处都有（比如侧栏里的入口名）
 */
const routeMarkers = [
  { url: '/tasks', marker: '任务看板', owner: 'collab 任务页' },
  { url: '/tasks/20261012091000-adapt01', marker: '协作站三包依赖换到 0.3 地基', owner: 'collab 记录页' },
  { url: '/calendar', marker: 'aria-label="上一个月"', owner: 'collab 日历页' },
  { url: '/calendar/2026-10-12', marker: '顺手估了一下测试板的功耗', owner: 'collab 日志页' },
  { url: '/comments', marker: 'data-comment-card', owner: 'comments 全站评论页' },
  { url: '/trajectory', marker: 'star-disk', owner: 'trajectory 星轨盘页（独立页面）' },
  { url: '/trajectory/2026-01-02-second', marker: '第二张卡', owner: 'trajectory 卡页' },
  { url: '/pinned', marker: 'data-pin-status', owner: '内容页（code-pin 外框）' },
  { url: '/writing/collapse-test', marker: '改动 A：开头新插的一段', owner: '内容页' },
]
const controlUrl = '/about'

/** 各功能 styles.css 里只有它才有的规则：进了页面的样式表，就说明功能样式汇总把它带进来了 */
const featureStyleSelectors = [
  { feature: 'code-pin', selector: '.code-pin' },
  { feature: 'comments（包样式）', selector: '.docsite-comment-row' },
  { feature: 'comments（接线文件里的正文高亮）', selector: '::highlight(docsite-comment)' },
  { feature: 'explainer', selector: '.dx-btn' },
  { feature: 'trajectory', selector: '.star-disk' },
]

/** 路由表展开成完整地址：参数名不同、位置相同的两条（tasks/:a 与 tasks/:b）也算重复 */
function flattenRoutes(routes, parentPath = '') {
  return routes.flatMap((route) => {
    const fullPath = route.path === undefined ? parentPath : [parentPath, route.path].filter(Boolean).join('/')
    const own = route.index ? [{ pattern: `${fullPath}(index)`, file: route.file }] : route.path === undefined ? [] : [{ pattern: fullPath.replace(/:[^/]+/g, ':'), file: route.file }]
    return [...own, ...flattenRoutes(route.children ?? [], fullPath)]
  })
}

/** 静态检查：Node 直接加载站点的 app/routes.ts（含各功能的 routes.ts），展开后没有两条路由占同一个地址 */
export async function runRouteTableChecks({ siteDir }) {
  const results = []
  const check = checkRunner(results)
  await check('路由表里没有两条路由占同一个地址（app/routes.ts 连同各功能的 routes.ts）', async () => {
    const { default: routes } = await import(pathToFileURL(path.join(siteDir, 'app', 'routes.ts')).href)
    const flat = flattenRoutes(routes)
    const filesOf = new Map()
    for (const { pattern, file } of flat) filesOf.set(pattern, [...(filesOf.get(pattern) ?? []), path.basename(file)])
    const clashes = [...filesOf].filter(([, files]) => files.length > 1).map(([pattern, files]) => `${pattern || '/'}：${files.join('、')}`)
    return { pass: clashes.length === 0, detail: clashes.length === 0 ? `${flat.length} 条路由，地址各不相同` : clashes.join('；') }
  })
  return results
}

async function sidebarLinks(page) {
  await waitForHydrated(page, '#nd-sidebar a[href="/trajectory"]')
  return page.locator('#nd-sidebar a').evaluateAll((links) => links.map((link) => link.getAttribute('href')))
}

/** 页面上全部样式表里的选择器（含 @media、@layer 里的） */
async function selectorsOnPage(page) {
  return page.evaluate(() => {
    const selectors = new Set()
    const walk = (rules) => {
      for (const rule of rules) {
        if (rule.selectorText) selectors.add(rule.selectorText)
        if (rule.cssRules) walk(rule.cssRules)
      }
    }
    for (const sheet of document.styleSheets) walk(sheet.cssRules)
    return [...selectors]
  })
}

export async function runAllFeaturesChecks({ browser, baseUrl }) {
  const results = []
  const problems = []
  const check = checkRunner(results)
  const context = await browser.newContext({ viewport: { width: 1400, height: 900 } })
  try {
    const page = await context.newPage()
    watchPage(page, 'all-features', problems)

    await check('侧栏的各功能入口都在、先后固定（刷新后不变）', async () => {
      await page.goto(`${baseUrl}/`, { waitUntil: 'load' })
      const first = await sidebarLinks(page)
      await page.reload({ waitUntil: 'load' })
      const second = await sidebarLinks(page)
      const entries = first.filter((href) => featureSidebarEntries.includes(href))
      const stable = JSON.stringify(first) === JSON.stringify(second)
      const pass = entries.join() === featureSidebarEntries.join() && stable
      return { pass, detail: `功能入口 ${entries.join('、')}（应为 ${featureSidebarEntries.join('、')}）；刷新前后侧栏 ${first.length} 个链接一样=${stable}` }
    })

    await check('功能的下级页面上，侧栏对应的入口高亮、别的功能入口不高亮', async () => {
      const outcomes = []
      for (const { url, entry } of highlightedEntryOf) {
        await page.goto(`${baseUrl}${url}`, { waitUntil: 'load' })
        const active = await page.locator('#nd-sidebar a[data-active="true"]').evaluateAll((links) => links.map((link) => link.getAttribute('href')))
        outcomes.push({ url, entry, active, ok: active.length === 1 && active[0] === entry })
      }
      const wrong = outcomes.filter(({ ok }) => !ok)
      return {
        pass: wrong.length === 0,
        detail: outcomes.map(({ url, active }) => `${url} 高亮 ${active.join('、') || '无'}`).join('；'),
      }
    })

    await check('各功能的地址由自己的路由接住（不被内容页或别的功能挡掉）', async () => {
      const controlHtml = await (await fetch(`${baseUrl}${controlUrl}`)).text()
      const outcomes = await Promise.all(
        routeMarkers.map(async ({ url, marker, owner }) => {
          const response = await fetch(`${baseUrl}${url}`)
          const html = await response.text()
          const problem = response.status !== 200 ? `→ ${response.status}` : !html.includes(marker) ? `页面里没有「${marker}」` : controlHtml.includes(marker) ? `「${marker}」在 ${controlUrl} 上也有，分辨不出` : ''
          return { url, owner, problem }
        }),
      )
      const wrong = outcomes.filter(({ problem }) => problem !== '')
      return { pass: wrong.length === 0, detail: wrong.length === 0 ? `${outcomes.length} 个地址都对：${outcomes.map(({ url }) => url).join('、')}` : wrong.map(({ url, owner, problem }) => `${url}（应由 ${owner} 接住）${problem}`).join('；') }
    })

    await check('各功能的样式都进了页面（功能样式汇总）', async () => {
      await page.goto(`${baseUrl}/`, { waitUntil: 'load' })
      const selectors = new Set(await selectorsOnPage(page))
      const missing = featureStyleSelectors.filter(({ selector }) => !selectors.has(selector)).map(({ feature, selector }) => `${feature} 的 ${selector}`)
      const collabOpen = await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--collab-open').trim())
      if (collabOpen !== '#b7791f') missing.push(`collab 的 :root --collab-open（拿到 ${collabOpen || '空'}）`)
      return { pass: missing.length === 0, detail: missing.length === 0 ? `${featureStyleSelectors.length} 条功能规则都在，collab 的状态色变量生效` : `缺：${missing.join('；')}` }
    })
  } finally {
    await context.close()
  }
  results.push(...problemResults(problems))
  return results
}
