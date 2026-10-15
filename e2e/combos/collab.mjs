import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { chromium } from 'playwright'
import { checkRunner, filesUnder, headingOf, markNoReload, problemResults, stepTimeoutMs, stillNoReload, waitForHydrated, watchPage } from '../lib/checks.mjs'
import { runLogged } from '../lib/process.mjs'
import { loadScaffold, packPackage, repoDir, testerIdentityCode } from '../lib/site.mjs'

/*
 * 「协作」组合：基础站 + @godcreator/collab。协作功能要协作仓的布局：站点在仓根的 site/，任务与模块在仓根的 collab/records/，
 * 所以这个组合的站点目录是 <运行目录>/collab-repo-<装法>/site。夹具（人员、记录、日志、内容页）都写在这个文件里，记录按记录格式写出
 */

export const collabPackage = { name: '@godcreator/collab', dir: path.join(repoDir, 'packages', 'collab') }
const collabFeature = 'collab'

/** 第二个人的身份码：只为检查「浏览器拿到的数据里没有身份码」，服务不用它启动 */
const otherIdentityCode = 'e2ealicecode01'
const people = [
  { id: 'tester', name: '测试员', codes: [testerIdentityCode] },
  { id: 'alice', name: '爱丽丝', codes: [otherIdentityCode] },
  { id: 'claude', name: 'Claude', agent: true },
]

const ids = {
  boardModule: '20261001090000-mboard1',
  cabinetModule: '20261001090001-mcabin1',
  schematic: '20261002090000-tschem1',
  layout: '20261002090001-tlayou1',
  testing: '20261002090002-ttest01',
  parts: '20261002090003-tparts1',
}

/** 测试员是 boardModule 与它下面两条任务的作者；爱丽丝的记录测试员只能改 status、owner、due、title、module */
const fixtureRecords = [
  { id: ids.boardModule, type: 'module', author: 'tester', title: 'e2e 采样板', due: '2026-12-31', owner: 'tester' },
  { id: ids.cabinetModule, type: 'module', author: 'alice', title: 'e2e 机柜', due: '2026-11-30', owner: 'alice' },
  { id: ids.schematic, type: 'task', author: 'tester', status: 'todo', title: 'e2e 画原理图', owner: 'tester', module: ids.boardModule },
  { id: ids.layout, type: 'task', author: 'tester', status: 'doing', title: 'e2e 布板', owner: 'alice', module: ids.boardModule },
  { id: ids.testing, type: 'task', author: 'alice', status: 'todo', title: 'e2e 写测试', owner: 'tester', module: ids.cabinetModule },
  { id: ids.parts, type: 'task', author: 'alice', status: 'done', title: 'e2e 买元件', owner: 'tester' },
]

const journalDate = '2026-10-12'
const journalText = `---\ntitle: ${journalDate} 的日志\n---\n\n今天推进 <RecordLink id="${ids.schematic}" />，顺手估了一下功耗 $P = UI$。\n\n明天接着做 [](/tasks/${ids.testing})。\n`
const linksPageText = `---\ntitle: 协作链接\n---\n\n正文里写成链接的任务：[](/tasks/${ids.layout})。\n`

const recordsDirOf = (siteDir) => path.join(path.dirname(siteDir), 'collab', 'records')
const recordFileText = (record) => `${JSON.stringify(record, null, 2)}\n`

/** 记录目录回到夹具：dev 与 start 用同一个站点目录，每轮从同一份数据开始 */
function resetRecords(siteDir) {
  const recordsDir = recordsDirOf(siteDir)
  mkdirSync(recordsDir, { recursive: true })
  for (const file of readdirSync(recordsDir)) rmSync(path.join(recordsDir, file))
  for (const record of fixtureRecords) writeFileSync(path.join(recordsDir, `${record.id}.json`), recordFileText(record))
}

/** 协作组合的站点目录：协作仓的 site/ */
export function collabSiteDirOf(runDir, installMode) {
  return path.join(runDir, `collab-repo-${installMode}`, 'site')
}

/** 跑协作组合前构建 collab 包（e2e 公共部分只构建平台包） */
export function buildCollabPackage(logDir) {
  runLogged('pnpm', ['--filter', collabPackage.name, 'build'], { cwd: repoDir, logFile: path.join(logDir, 'build-collab.txt'), timeoutMs: 600_000 })
}

export function packCollabPackage(tarballDir, logDir) {
  return packPackage(collabPackage.name, collabPackage.dir, tarballDir, logDir)
}

const toPosix = (file) => file.replaceAll('\\', '/')

/**
 * 用 createSite 建基础站，写进协作包依赖（link 或 file，和 createSite 的装法一致）与夹具：人员、日志、内容页，以及仓根的 collab/records/。
 * 记录目录与日志目录在服务启动前就要在：功能 styles.css 里的 @source not 才对它们生效
 */
export async function generateCollabSite({ siteDir, installMode, tarballs, collabTarball, scriptPort }) {
  const { createSite } = await loadScaffold()
  const packageSource = installMode === 'link' ? { kind: 'link', repoDir } : { kind: 'file', tarballs: tarballs.platform }
  createSite({ dir: siteDir, siteName: 'e2e 协作站', port: scriptPort, people, packageSource })
  const packageJsonFile = path.join(siteDir, 'package.json')
  const packageJson = JSON.parse(readFileSync(packageJsonFile, 'utf8'))
  packageJson.dependencies[collabPackage.name] = installMode === 'link' ? `link:${toPosix(collabPackage.dir)}` : `file:${toPosix(collabTarball)}`
  writeFileSync(packageJsonFile, `${JSON.stringify(packageJson, null, 2)}\n`)
  mkdirSync(path.join(siteDir, 'journal'), { recursive: true })
  writeFileSync(path.join(siteDir, 'journal', `${journalDate}.mdx`), journalText)
  writeFileSync(path.join(siteDir, 'content', 'collab-links.mdx'), linksPageText)
  resetRecords(siteDir)
}

/** 装完依赖后加协作功能：功能目录的文件、汇总文件里的路由与日志集合 */
export async function addCollabFeatureWithChecks({ siteDir, addFeature }) {
  const results = []
  const check = checkRunner(results)
  await check('addFeature collab：补进功能目录，汇总文件接上路由、运行时、日志集合与样式', async () => {
    const added = addFeature({ siteDir, packageName: collabPackage.name })
    const featuresDir = path.join(siteDir, 'app', 'features')
    const routesIndex = readFileSync(path.join(featuresDir, 'routes.generated.ts'), 'utf8')
    const runtimeIndex = readFileSync(path.join(featuresDir, 'runtime.generated.ts'), 'utf8')
    const collectionsIndex = readFileSync(path.join(featuresDir, 'collections.generated.ts'), 'utf8')
    const stylesIndex = readFileSync(path.join(featuresDir, 'styles.generated.css'), 'utf8')
    const pass =
      added.feature === collabFeature &&
      added.keptFiles.length === 0 &&
      ['routes.ts', 'feature.tsx', 'site.server.ts', 'mdx.ts', 'styles.css'].every((file) => added.addedFiles.includes(file)) &&
      routesIndex.includes(`./${collabFeature}/routes.ts`) &&
      runtimeIndex.includes(`./${collabFeature}/feature.tsx`) &&
      collectionsIndex.includes('export const journal = collabMdx.collections.journal(sitePlugins)') &&
      stylesIndex.includes(`./${collabFeature}/styles.css`)
    return { pass, detail: `补进 ${added.addedFiles.length} 个文件；功能 ${added.features.join('、')}` }
  })
  return results
}

async function loadCollabCore() {
  return import(pathToFileURL(path.join(collabPackage.dir, 'dist', 'core', 'index.mjs')).href)
}

const boardSection = (page) => page.locator('section', { has: page.locator('h2', { hasText: '任务看板' }) })

/** 看板上现在显示的任务标题，按字典序 */
async function boardTitles(page) {
  return (await boardSection(page).locator('li a').allTextContents()).map((text) => text.trim()).sort()
}

async function waitForBoard(page, expected) {
  await page.waitForFunction(
    (titles) => {
      const section = [...document.querySelectorAll('section')].find((each) => each.querySelector('h2')?.textContent === '任务看板')
      const shown = [...(section?.querySelectorAll('li a') ?? [])].map((each) => each.textContent?.trim()).sort()
      return JSON.stringify(shown) === JSON.stringify(titles)
    },
    [...expected].sort(),
    { timeout: stepTimeoutMs },
  )
}

const recordFiles = (siteDir) => readdirSync(recordsDirOf(siteDir)).sort()
const readRecord = (siteDir, id) => JSON.parse(readFileSync(path.join(recordsDirOf(siteDir), `${id}.json`), 'utf8'))

/** dev 下 Tailwind 扫到被写的文件会在写入之后才整页刷新：写完等一会儿再看标记 */
async function noReloadAfterWrite(page) {
  await page.waitForTimeout(1_500)
  return stillNoReload(page)
}

/** 基础站 + 协作组合的检查。mode 是 dev 或 start；记录每轮回到夹具 */
export async function runCollabChecks({ baseUrl, mode, siteDir, feedToken, runTag }) {
  const results = []
  const problems = []
  const check = checkRunner(results)
  resetRecords(siteDir)
  const browser = await chromium.launch({ headless: true })
  try {
    const context = await browser.newContext({ viewport: { width: 1400, height: 1000 } })
    const page = await context.newPage()
    watchPage(page, 'collab', problems)

    await check('任务页直接打开：人员、模块、任务看板三块', async () => {
      const response = await page.goto(`${baseUrl}/tasks`, { waitUntil: 'load' })
      const heading = await headingOf(page)
      const sections = (await page.locator('h2').allTextContents()).filter((text) => ['人员', '模块', '任务看板'].includes(text))
      const cards = await page.locator('button[title^="只看 "]').count()
      const ganttRows = await page.locator('button[title="只看这个模块的任务"]').count()
      const titles = await boardTitles(page)
      const pass = response?.status() === 200 && heading === '任务' && sections.join() === '人员,模块,任务看板' && cards === 2 && ganttRows === 2 && titles.length === 4
      return { pass, detail: `→ ${response?.status()}，h1=${heading}，${sections.join('、')}；人员卡 ${cards} 张（agent 不列），甘特图 ${ganttRows} 行，看板 ${titles.length} 张` }
    })

    await check('两层筛选：点人员卡只看他负责的，再点甘特图上的模块只看其中属于这个模块的', async () => {
      await waitForHydrated(page, 'button[title="只看 测试员 的任务"]')
      await page.click('button[title="只看 测试员 的任务"]')
      await waitForBoard(page, ['e2e 画原理图', 'e2e 写测试', 'e2e 买元件'])
      const byPerson = await boardTitles(page)
      await page.locator('button[title="只看这个模块的任务"]', { hasText: 'e2e 采样板' }).click()
      await waitForBoard(page, ['e2e 画原理图'])
      const byBoth = await boardTitles(page)
      await page.click('button[title="看全部人的任务"]')
      await waitForBoard(page, ['e2e 画原理图', 'e2e 布板'])
      const byModule = await boardTitles(page)
      return { pass: true, detail: `测试员：${byPerson.join('、')}；再加模块：${byBoth.join('、')}；去掉人员：${byModule.join('、')}` }
    })

    let createdId = ''
    await check('新建任务（useFetcher 提交到 /tasks 的 action，建好跳到它那一页，没有整页刷新）', async () => {
      await page.goto(`${baseUrl}/tasks`, { waitUntil: 'load' })
      await waitForHydrated(page, 'button[title^="只看 "]')
      await markNoReload(page)
      const before = recordFiles(siteDir)
      await page.getByRole('button', { name: '新建任务', exact: true }).click()
      await page.fill('[role="dialog"] input[aria-label="标题"]', `e2e 新任务 ${runTag}`)
      await page.click('[role="dialog"] button[type="submit"]')
      await page.waitForURL(/\/tasks\/\d{14}-[a-z0-9]{7}$/, { timeout: stepTimeoutMs })
      createdId = new URL(page.url()).pathname.split('/').at(-1)
      await page.locator('h1', { hasText: `e2e 新任务 ${runTag}` }).waitFor({ timeout: stepTimeoutMs })
      const after = recordFiles(siteDir)
      const stored = readRecord(siteDir, createdId)
      const kept = await noReloadAfterWrite(page)
      const pass = after.length === before.length + 1 && stored.author === 'tester' && stored.status === 'todo' && kept
      return { pass, detail: `新记录 ${createdId}（作者 ${stored.author}），记录文件 ${before.length} → ${after.length}，没有整页刷新=${kept}` }
    })

    await check('改字段（状态改成进行中：useFetcher 写进记录文件，页面跟着变，没有整页刷新）', async () => {
      await waitForHydrated(page, 'select[aria-label="状态"]')
      await markNoReload(page)
      await page.selectOption('select[aria-label="状态"]', 'doing')
      await page.waitForFunction(() => document.querySelector('select[aria-label="状态"]')?.value === 'doing', null, { timeout: stepTimeoutMs })
      const deadline = Date.now() + stepTimeoutMs
      while (readRecord(siteDir, createdId).status !== 'doing' && Date.now() < deadline) await page.waitForTimeout(200)
      const stored = readRecord(siteDir, createdId).status
      const kept = await noReloadAfterWrite(page)
      return { pass: stored === 'doing' && kept, detail: `文件里 status=${stored}，没有整页刷新=${kept}` }
    })

    await check('删掉刚建的任务（确认后提交，删完跳回任务页）', async () => {
      await page.getByRole('button', { name: '删除', exact: true }).click()
      await page.getByRole('button', { name: '确认删除', exact: true }).click()
      await page.waitForURL(`${baseUrl}/tasks`, { timeout: stepTimeoutMs })
      const gone = !existsSync(path.join(recordsDirOf(siteDir), `${createdId}.json`))
      const kept = await noReloadAfterWrite(page)
      return { pass: gone && kept, detail: `记录文件删掉=${gone}，回到 /tasks，没有整页刷新=${kept}` }
    })

    await check('写入规则拒绝时显示原话（删还有任务的模块）', async () => {
      await page.goto(`${baseUrl}/tasks/${ids.boardModule}`, { waitUntil: 'load' })
      await waitForHydrated(page, 'button[title="点一下改标题"]')
      await page.getByRole('button', { name: '删除', exact: true }).click()
      const [response] = await Promise.all([
        page.waitForResponse((each) => each.request().method() === 'POST' && each.url().includes(`/tasks/${ids.boardModule}`), { timeout: stepTimeoutMs }),
        page.getByRole('button', { name: '确认删除', exact: true }).click(),
      ])
      const message = page.locator('p.text-danger', { hasText: '先把这些任务删掉或改到别的模块，再删模块' })
      await message.waitFor({ timeout: stepTimeoutMs })
      const stillThere = existsSync(path.join(recordsDirOf(siteDir), `${ids.boardModule}.json`))
      return { pass: response.status() === 422 && stillThere, detail: `POST → ${response.status()}，页面上：${(await message.textContent())?.trim()}；模块还在=${stillThere}` }
    })

    await check('记录 404：id 合法但没有这条、id 不合法', async () => {
      const missing = await fetch(`${baseUrl}/tasks/20991231000000-nothing`)
      const invalid = await fetch(`${baseUrl}/tasks/not-a-record`)
      const text = await missing.text()
      return { pass: missing.status === 404 && invalid.status === 404 && text.includes('可能已经被删掉了'), detail: `没有这条 → ${missing.status}，id 不合法 → ${invalid.status}` }
    })

    await check('日历：模块截止日有记号、有日志的日子带记号，翻月后点进那天的日志页（站内导航，正文的公式与记录链接都渲染）', async () => {
      await page.goto(`${baseUrl}/calendar?month=2026-11`, { waitUntil: 'load' })
      await waitForHydrated(page, 'a[aria-label="上一个月"]')
      const dueMarks = await page.locator('a[href="/calendar/2026-11-30"] span[title="e2e 机柜 截止"]').count()
      await markNoReload(page)
      await page.click('a[aria-label="上一个月"]')
      const dayLink = page.locator(`a[href="/calendar/${journalDate}"]`)
      await dayLink.waitFor({ timeout: stepTimeoutMs })
      const marked = await dayLink.locator('[aria-label="有日志"]').count()
      await dayLink.click()
      await page.waitForURL(`${baseUrl}/calendar/${journalDate}`, { timeout: stepTimeoutMs })
      const chip = page.locator('a', { hasText: 'e2e 画原理图' })
      await chip.waitFor({ timeout: stepTimeoutMs })
      const katex = await page.locator('.katex').count()
      const linkChip = await page.locator('a', { hasText: 'e2e 写测试' }).count()
      const kept = await stillNoReload(page)
      return {
        pass: dueMarks === 1 && marked === 1 && katex >= 1 && linkChip === 1 && kept,
        detail: `11-30 的模块截止记号 ${dueMarks} 个，${journalDate} 的日志记号 ${marked} 个；日志页 .katex ${katex} 个，RecordLink 与 [](/tasks/…) 都换成卡片，没有整页刷新=${kept}`,
      }
    })

    await check('内容页里写成链接的任务换成卡片（remark 插件进了站点的页面集合）', async () => {
      await page.goto(`${baseUrl}/collab-links`, { waitUntil: 'load' })
      const chip = page.locator(`a[href="/tasks/${ids.layout}"]`, { hasText: 'e2e 布板' })
      await chip.waitFor({ timeout: stepTimeoutMs })
      return { pass: true, detail: '[](/tasks/<id>) 显示成任务标题' }
    })

    await check('侧栏的「任务」「日历」入口站内导航', async () => {
      await page.goto(`${baseUrl}/`, { waitUntil: 'load' })
      await waitForHydrated(page, '#nd-sidebar a[href="/tasks"]')
      // React Router dev 按需发现路由：侧栏链接一渲染就去取路由清单，取到之前点下去会退回整页跳转
      await page.waitForLoadState('networkidle')
      await markNoReload(page)
      await page.click('#nd-sidebar a[href="/calendar"]')
      await page.locator('h1', { hasText: '日历' }).waitFor({ timeout: stepTimeoutMs })
      await page.click('#nd-sidebar a[href="/tasks"]')
      await page.locator('h1', { hasText: '任务' }).waitFor({ timeout: stepTimeoutMs })
      return { pass: await stillNoReload(page), detail: '侧栏点「日历」再点「任务」' }
    })

    const commentText = `e2e 任务页评论 ${runTag}`
    await check(`任务页评论（${mode === 'dev' ? '写进去并显示' : 'start：写进评论目录，正文是构建时的快照'}）`, async () => {
      await page.goto(`${baseUrl}/tasks`, { waitUntil: 'load' })
      await waitForHydrated(page, '[data-comment-dock-open]')
      const commentsDir = path.join(siteDir, 'comments')
      const before = filesUnder(commentsDir).length
      await page.click('[data-comment-dock-open]')
      await page.click('[data-new-thread-toggle]')
      await page.fill('[data-new-thread-form] textarea[name="body"]', commentText)
      const [response] = await Promise.all([
        page.waitForResponse((each) => each.request().method() === 'POST' && new URL(each.url()).pathname.startsWith('/tasks'), { timeout: stepTimeoutMs }),
        page.click('[data-new-thread-form] button[type="submit"]'),
      ])
      const after = filesUnder(commentsDir).length
      const written = filesUnder(commentsDir).some((file) => readFileSync(file, 'utf8').includes(commentText))
      let shown = 'start 下不看正文'
      if (mode === 'dev') {
        await page.locator('[data-comment-card]', { hasText: commentText }).waitFor({ timeout: stepTimeoutMs })
        shown = '评论卡片显示出来'
      }
      return { pass: response.status() === 200 && after === before + 1 && written, detail: `POST ${new URL(response.url()).pathname} → ${response.status()}，评论目录文件 ${before} → ${after}，${shown}` }
    })

    await check('通知经推送通道到达通知栏（已打开的页面不刷新就出现，新打开的页面首屏就有）', async () => {
      await page.goto(`${baseUrl}/tasks`, { waitUntil: 'load' })
      await waitForHydrated(page, 'button[title^="只看 "]')
      await markNoReload(page)
      const barBefore = await page.locator('button', { hasText: '条找我的' }).count()
      const { notificationOf } = await loadCollabCore()
      const notification = notificationOf({ kind: 'task', recordId: ids.testing, title: 'e2e 写测试', due: null, detail: null })
      const pushed = await fetch(`${baseUrl}/__docsite/feed/collab`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-docsite-token': feedToken },
        body: JSON.stringify({ notifications: [notification], projectLeads: ['tester'] }),
      })
      const bar = page.locator('button', { hasText: '1 条找我的' })
      await bar.waitFor({ timeout: stepTimeoutMs })
      await bar.click()
      await page.locator('section[aria-label="要处理的事"]', { hasText: '指派给我的任务：e2e 写测试' }).waitFor({ timeout: stepTimeoutMs })
      const kept = await stillNoReload(page)
      const fresh = await context.newPage()
      watchPage(fresh, 'collab-fresh', problems)
      await fresh.goto(`${baseUrl}/calendar`, { waitUntil: 'load' })
      const firstPaint = await fresh.locator('button', { hasText: '1 条找我的' }).count()
      await fresh.close()
      return { pass: pushed.status === 204 && barBefore === 0 && kept && firstPaint === 1, detail: `推送 ${pushed.status}；推之前通知栏 ${barBefore} 个，推之后出现、展开看得到那条，没有整页刷新=${kept}；新打开日历页首屏通知栏 ${firstPaint} 个` }
    })

    await check('浏览器拿到的页面与 loader 数据里没有身份码', async () => {
      const urls = ['/', '/tasks', `/tasks/${ids.schematic}`, '/calendar', `/calendar/${journalDate}`]
      const bodies = await Promise.all(
        urls
          .flatMap((url) => [url, url === '/' ? '/_.data' : `${url}.data`])
          .map(async (url) => {
            const response = await fetch(`${baseUrl}${url}`)
            return { url, status: response.status, text: await response.text() }
          }),
      )
      const leaks = bodies.flatMap(({ url, text }) => [testerIdentityCode, otherIdentityCode].filter((code) => text.includes(code)).map((code) => `${url}: ${code}`))
      const failed = bodies.filter(({ status }) => status !== 200).map(({ url, status }) => `${url} → ${status}`)
      const peopleSeen = bodies.some(({ text }) => text.includes('爱丽丝'))
      return { pass: leaks.length === 0 && failed.length === 0 && peopleSeen, detail: leaks.length > 0 ? leaks.join('；') : `${bodies.length} 份响应里搜不到两个人的身份码（人名在里面=${peopleSeen}）${failed.length > 0 ? `；没打开的：${failed.join('、')}` : ''}` }
    })

    if (mode === 'start') {
      await check('浏览器产物里没有协作的服务端代码', async () => {
        const clientFiles = filesUnder(path.join(siteDir, 'build', 'client')).filter((file) => file.endsWith('.js'))
        // 协作服务端代码里才有的原话：写入 action 的报错、在本机打开 repo: 链接的报错
        const serverOnlyMarkers = ['node:fs', 'node:child_process', '认不出 intent', '运行 VS Code 的 code 命令失败', 'DOCSITE_IDENTITY_CODE']
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
  results.push(...problemResults(problems.filter((line) => !isExpectedRejection(line))))
  return results
}

/** 「写入规则拒绝」那一项故意让 action 回 422：那次请求与浏览器为它打的那行控制台报错不算问题 */
function isExpectedRejection(line) {
  const rejectedRequest = line.startsWith('[collab http 422] ') && line.endsWith(`/tasks/${ids.boardModule}.data`)
  const consoleLineForIt = line.startsWith('[collab console.error] Failed to load resource') && line.includes('status of 422')
  return rejectedRequest || consoleLineForIt
}
