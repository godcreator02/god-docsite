import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { checkRunner, filesUnder, headingOf, markNoReload, openCommentsInbox, postFormToAction, problemResults, serverCodeInClientBuild, stepTimeoutMs, stillNoReload, waitForHydrated, watchPage } from '../lib/checks.mjs'
import { recordsDirOf } from '../lib/run-scratch.mjs'
import { repoDir, testerIdentityCode } from '../lib/site.mjs'

/*
 * 协作功能的检查，跑在测试站的协作数据上（协作仓的 collab/records/ 与站点的 journal/、people.json）。
 * 只读的检查对着已跟踪的数据；要写的检查只动本次运行新建的记录（标题带 runTag），跑完由 removeRunLeftovers 删掉
 */

/** 测试数据里几条用到的记录与人：卡罗尔负责的任务分在两个模块里，两层筛选才筛得出不同的结果 */
const tracked = {
  rewriteModule: '20261012090000-rewrite',
  adaptTask: '20261012091000-adapt01',
  tasksPageTask: '20261012091001-tskpage',
  journalDate: '2026-10-12',
  carol: { id: 'carol-test', name: '卡罗尔' },
  /** 站长的身份码：只为检查「浏览器拿到的数据里没有身份码」，服务不用它启动 */
  otherIdentityCode: 'y893nabqixve',
}

async function loadCollabCore() {
  return import(pathToFileURL(path.join(repoDir, 'packages', 'collab', 'dist', 'core', 'index.mjs')).href)
}

const readRecords = (siteDir) =>
  readdirSync(recordsDirOf(siteDir))
    .filter((name) => name.endsWith('.json'))
    .map((name) => JSON.parse(readFileSync(path.join(recordsDirOf(siteDir), name), 'utf8')))
const recordFiles = (siteDir) => readdirSync(recordsDirOf(siteDir)).sort()
const readRecord = (siteDir, id) => JSON.parse(readFileSync(path.join(recordsDirOf(siteDir), `${id}.json`), 'utf8'))
const titlesOf = (records) => records.map((record) => record.title).sort()

/**
 * 本次运行的一个模块和挂在它下面的一条任务，作者与负责人都是测试员：「写入规则拒绝」要删的是自己建的模块，
 * 日历上要有一个十一月截止的模块。按记录格式写成文件（encodeRecordFile），标题带 runTag
 */
async function writeRunRecords(siteDir, runTag) {
  const { encodeRecordFile, newRecordId } = await loadCollabCore()
  const module = { id: newRecordId(), type: 'module', author: 'tester', title: `e2e 模块 ${runTag}`, due: '2026-11-30', owner: 'tester' }
  const task = { id: newRecordId(), type: 'task', author: 'tester', status: 'todo', title: `e2e 任务 ${runTag}`, owner: 'tester', module: module.id }
  for (const record of [module, task]) writeFileSync(path.join(recordsDirOf(siteDir), `${record.id}.json`), encodeRecordFile(record))
  return { module, task }
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

/** 看板标题旁的筛选说明，和看板上方选中的那个筛选（名字连着计数） */
async function boardFilterShown(page) {
  const note = ((await boardSection(page).locator('[data-board-filter-note]').textContent({ timeout: stepTimeoutMs })) ?? '').trim()
  const chip = ((await boardSection(page).locator('[aria-label="看板显示哪些任务"] button[aria-pressed="true"]').textContent({ timeout: stepTimeoutMs })) ?? '').replace(/\s+/g, '')
  return { note, chip }
}

/** dev 下 Tailwind 扫到被写的文件会在写入之后才整页刷新：写完等一会儿再看标记 */
async function noReloadAfterWrite(page) {
  await page.waitForTimeout(1_500)
  return stillNoReload(page)
}

/** start 是只读的发布版：页面上没有写入口，绕过页面直接提交也被拒，记录与评论目录都不变 */
async function readonlyStartCheck({ page, baseUrl, siteDir, runTag }) {
  const commentsDir = path.join(siteDir, 'comments')
  const recordsBefore = recordFiles(siteDir).length
  const commentsBefore = filesUnder(commentsDir).length
  await page.goto(`${baseUrl}/tasks`, { waitUntil: 'load' })
  await waitForHydrated(page, '[data-comment-inbox-toggle]')
  const createButtons = await page.getByRole('button', { name: '新建任务', exact: true }).count()
  await openCommentsInbox(page)
  const reason = page.locator('[data-readonly-reason]')
  await reason.waitFor({ timeout: stepTimeoutMs })
  const reasonText = ((await reason.textContent()) ?? '').trim()
  const taskPost = await postFormToAction(baseUrl, '/tasks.data', { intent: 'create-record', type: 'task', title: `e2e start 任务 ${runTag}` })
  const commentPost = await postFormToAction(baseUrl, '/tasks.data', { intent: 'create-thread', page: '/tasks', body: `e2e start 任务页评论 ${runTag}` })
  const recordsAfter = recordFiles(siteDir).length
  const commentsAfter = filesUnder(commentsDir).length
  const rejected = [taskPost, commentPost].every(({ status, text }) => status === 403 && text.includes('发布版'))
  return {
    pass: reasonText.includes('发布版') && createButtons === 0 && rejected && recordsAfter === recordsBefore && commentsAfter === commentsBefore,
    detail: `新建任务按钮 ${createButtons} 个，评论收件箱写着「${reasonText}」；直接提交任务 → ${taskPost.status}、评论 → ${commentPost.status}；记录文件 ${recordsBefore} → ${recordsAfter}，评论目录文件 ${commentsBefore} → ${commentsAfter}`,
  }
}

/** 协作功能的检查。mode 是 dev 或 start：写任务、写评论、收通知只在 dev 下做，start 是只读的发布版，核对写不进去 */
export async function runCollabChecks({ browser, baseUrl, mode, siteDir, feedToken, runTag }) {
  const results = []
  const problems = []
  const check = checkRunner(results)
  const runRecords = await writeRunRecords(siteDir, runTag)
  const context = await browser.newContext({ viewport: { width: 1400, height: 1000 } })
  try {
    const page = await context.newPage()
    watchPage(page, 'collab', problems)

    await check('任务页直接打开：人员、模块、任务看板三块', async () => {
      const records = readRecords(siteDir)
      const people = JSON.parse(readFileSync(path.join(siteDir, 'people.json'), 'utf8'))
      const expected = { cards: people.filter((person) => !person.agent).length, modules: records.filter((record) => record.type === 'module').length, tasks: records.filter((record) => record.type === 'task').length }
      const response = await page.goto(`${baseUrl}/tasks`, { waitUntil: 'load' })
      const heading = await headingOf(page)
      const sections = (await page.locator('h2').allTextContents()).filter((text) => ['人员', '模块', '任务看板'].includes(text))
      const cards = await page.locator('button[title^="只看 "]').count()
      const ganttRows = await page.locator('button[title="只看这个模块的任务"]').count()
      const titles = await boardTitles(page)
      const pass = response?.status() === 200 && heading === '任务' && sections.join() === '人员,模块,任务看板' && cards === expected.cards && ganttRows === expected.modules && titles.length === expected.tasks
      return { pass, detail: `→ ${response?.status()}，h1=${heading}，${sections.join('、')}；人员卡 ${cards}/${expected.cards} 张（agent 不列），甘特图 ${ganttRows}/${expected.modules} 行，看板 ${titles.length}/${expected.tasks} 张` }
    })

    await check('两层筛选：点人员卡只看他负责的，再点甘特图上的模块只看其中属于这个模块的', async () => {
      const tasks = readRecords(siteDir).filter((record) => record.type === 'task')
      const moduleTitle = readRecord(siteDir, tracked.rewriteModule).title
      const ofPerson = titlesOf(tasks.filter((task) => task.owner === tracked.carol.id))
      const ofBoth = titlesOf(tasks.filter((task) => task.owner === tracked.carol.id && task.module === tracked.rewriteModule))
      const ofModule = titlesOf(tasks.filter((task) => task.module === tracked.rewriteModule))
      await waitForHydrated(page, `button[title="只看 ${tracked.carol.name} 的任务"]`)
      await page.click(`button[title="只看 ${tracked.carol.name} 的任务"]`)
      await waitForBoard(page, ofPerson)
      await page.locator('button[title="只看这个模块的任务"]', { hasText: moduleTitle }).click()
      await waitForBoard(page, ofBoth)
      const bothShown = await boardFilterShown(page)
      await page.click('button[title="看全部人的任务"]')
      await waitForBoard(page, ofModule)
      const moduleShown = await boardFilterShown(page)
      const distinct = new Set([ofPerson, ofBoth, ofModule].map((titles) => titles.join())).size === 3
      const bothNoteOk = bothShown.note.startsWith(`只看 ${tracked.carol.name} 在模块「${moduleTitle}」里的任务`) && bothShown.chip === `${moduleTitle}${ofBoth.length}`
      const moduleNoteOk = moduleShown.note.startsWith(`只看模块「${moduleTitle}」里的任务`) && moduleShown.chip === `${moduleTitle}${ofModule.length}`
      return {
        pass: distinct && bothNoteOk && moduleNoteOk,
        detail: `${tracked.carol.name}：${ofPerson.join('、')}；再加模块：${ofBoth.join('、')}（说明「${bothShown.note}」，选中的筛选「${bothShown.chip}」）；去掉人员：${ofModule.join('、')}（说明「${moduleShown.note}」，选中的筛选「${moduleShown.chip}」）；三步结果各不相同=${distinct}`,
      }
    })

    if (mode === 'dev') {
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
        const moduleId = runRecords.module.id
        await page.goto(`${baseUrl}/tasks/${moduleId}`, { waitUntil: 'load' })
        await waitForHydrated(page, 'button[title="点一下改标题"]')
        await page.getByRole('button', { name: '删除', exact: true }).click()
        const [response] = await Promise.all([
          page.waitForResponse((each) => each.request().method() === 'POST' && each.url().includes(`/tasks/${moduleId}`), { timeout: stepTimeoutMs }),
          page.getByRole('button', { name: '确认删除', exact: true }).click(),
        ])
        const message = page.locator('p.text-danger', { hasText: '先把这些任务删掉或改到别的模块，再删模块' })
        await message.waitFor({ timeout: stepTimeoutMs })
        const stillThere = existsSync(path.join(recordsDirOf(siteDir), `${moduleId}.json`))
        return { pass: response.status() === 422 && stillThere, detail: `POST → ${response.status()}，页面上：${(await message.textContent())?.trim()}；模块还在=${stillThere}` }
      })
    } else {
      await check('start 只读：任务页没有新建按钮、评论面板写明原因，直接提交任务与评论都被拒且不写文件（服务有身份码也不认）', () => readonlyStartCheck({ page, baseUrl, siteDir, runTag }))
    }

    await check('记录 404：id 合法但没有这条、id 不合法', async () => {
      const missing = await fetch(`${baseUrl}/tasks/20991231000000-nothing`)
      const invalid = await fetch(`${baseUrl}/tasks/not-a-record`)
      const text = await missing.text()
      return { pass: missing.status === 404 && invalid.status === 404 && text.includes('可能已经被删掉了'), detail: `没有这条 → ${missing.status}，id 不合法 → ${invalid.status}` }
    })

    await check('日历：模块截止日有记号、有日志的日子带记号，翻月后点进那天的日志页（站内导航，正文的公式与记录链接都渲染）', async () => {
      const adaptTitle = readRecord(siteDir, tracked.adaptTask).title
      const tasksPageTitle = readRecord(siteDir, tracked.tasksPageTask).title
      await page.goto(`${baseUrl}/calendar?month=2026-11`, { waitUntil: 'load' })
      await waitForHydrated(page, 'a[aria-label="上一个月"]')
      const dueMarks = await page.locator(`a[href="/calendar/${runRecords.module.due}"] span[title="${runRecords.module.title} 截止"]`).count()
      await markNoReload(page)
      await page.click('a[aria-label="上一个月"]')
      const dayLink = page.locator(`a[href="/calendar/${tracked.journalDate}"]`)
      await dayLink.waitFor({ timeout: stepTimeoutMs })
      const marked = await dayLink.locator('[aria-label="有日志"]').count()
      await dayLink.click()
      await page.waitForURL(`${baseUrl}/calendar/${tracked.journalDate}`, { timeout: stepTimeoutMs })
      const chip = page.locator('a', { hasText: adaptTitle })
      await chip.waitFor({ timeout: stepTimeoutMs })
      const katex = await page.locator('.katex').count()
      const linkChip = await page.locator(`a[href="/tasks/${tracked.tasksPageTask}"]`, { hasText: tasksPageTitle }).count()
      const kept = await stillNoReload(page)
      return {
        pass: dueMarks === 1 && marked === 1 && katex >= 1 && linkChip === 1 && kept,
        detail: `${runRecords.module.due} 的模块截止记号 ${dueMarks} 个，${tracked.journalDate} 的日志记号 ${marked} 个；日志页 .katex ${katex} 个，RecordLink 与 [](/tasks/…) 都换成卡片，没有整页刷新=${kept}`,
      }
    })

    await check('内容页里写成链接的任务换成卡片（remark 插件进了站点的页面集合）', async () => {
      await page.goto(`${baseUrl}/usage`, { waitUntil: 'load' })
      const chip = page.locator(`a[href="/tasks/${tracked.tasksPageTask}"]`, { hasText: readRecord(siteDir, tracked.tasksPageTask).title })
      await chip.waitFor({ timeout: stepTimeoutMs })
      return { pass: true, detail: '[](/tasks/<id>) 显示成任务标题' }
    })

    await check('侧栏的「任务」「日历」入口站内导航', async () => {
      await page.goto(`${baseUrl}/about`, { waitUntil: 'load' })
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

    if (mode === 'dev') {
      const commentText = `e2e 任务页评论 ${runTag}`
      await check('任务页评论（写进去并显示）', async () => {
        await page.goto(`${baseUrl}/tasks`, { waitUntil: 'load' })
        const commentsDir = path.join(siteDir, 'comments')
        const before = filesUnder(commentsDir).length
        await openCommentsInbox(page)
        await page.fill('[data-new-thread-form] textarea[name="body"]', commentText)
        const [response] = await Promise.all([
          page.waitForResponse((each) => each.request().method() === 'POST' && new URL(each.url()).pathname.startsWith('/tasks'), { timeout: stepTimeoutMs }),
          page.click('[data-new-thread-form] button[type="submit"]'),
        ])
        const after = filesUnder(commentsDir).length
        const written = filesUnder(commentsDir).some((file) => readFileSync(file, 'utf8').includes(commentText))
        await page.locator('[data-comment-card]', { hasText: commentText }).waitFor({ timeout: stepTimeoutMs })
        return { pass: response.status() === 200 && after === before + 1 && written, detail: `POST ${new URL(response.url()).pathname} → ${response.status()}，评论目录文件 ${before} → ${after}，评论卡片显示出来` }
      })

      await check('通知经推送通道到达通知栏（已打开的页面不刷新就出现，新打开的页面首屏就有）', async () => {
        await page.goto(`${baseUrl}/tasks`, { waitUntil: 'load' })
        await waitForHydrated(page, 'button[title^="只看 "]')
        await markNoReload(page)
        const barBefore = await page.locator('button', { hasText: '条找我的' }).count()
        const { notificationOf } = await loadCollabCore()
        const notification = notificationOf({ kind: 'task', recordId: runRecords.task.id, title: runRecords.task.title, due: null, detail: null })
        const pushed = await fetch(`${baseUrl}/__docsite/feed/collab`, {
          method: 'POST',
          headers: { 'content-type': 'application/json', 'x-docsite-token': feedToken },
          body: JSON.stringify({ notifications: [notification], projectLeads: ['tester'] }),
        })
        const bar = page.locator('button', { hasText: '1 条找我的' })
        await bar.waitFor({ timeout: stepTimeoutMs })
        await bar.click()
        await page.locator('section[aria-label="要处理的事"]', { hasText: `指派给我的任务：${runRecords.task.title}` }).waitFor({ timeout: stepTimeoutMs })
        const kept = await stillNoReload(page)
        const fresh = await context.newPage()
        watchPage(fresh, 'collab-fresh', problems)
        await fresh.goto(`${baseUrl}/calendar`, { waitUntil: 'load' })
        const firstPaint = await fresh.locator('button', { hasText: '1 条找我的' }).count()
        await fresh.close()
        return { pass: pushed.status === 204 && barBefore === 0 && kept && firstPaint === 1, detail: `推送 ${pushed.status}；推之前通知栏 ${barBefore} 个，推之后出现、展开看得到那条，没有整页刷新=${kept}；新打开日历页首屏通知栏 ${firstPaint} 个` }
      })
    }

    await check('浏览器拿到的页面与 loader 数据里没有身份码', async () => {
      const urls = ['/', '/tasks', `/tasks/${tracked.adaptTask}`, '/calendar', `/calendar/${tracked.journalDate}`]
      const bodies = await Promise.all(
        urls
          .flatMap((url) => [url, url === '/' ? '/_.data' : `${url}.data`])
          .map(async (url) => {
            const response = await fetch(`${baseUrl}${url}`)
            return { url, status: response.status, text: await response.text() }
          }),
      )
      const codes = [testerIdentityCode, tracked.otherIdentityCode]
      const leaks = bodies.flatMap(({ url, text }) => codes.filter((code) => text.includes(code)).map((code) => `${url}: ${code}`))
      const failed = bodies.filter(({ status }) => status !== 200).map(({ url, status }) => `${url} → ${status}`)
      const peopleSeen = bodies.some(({ text }) => text.includes(tracked.carol.name))
      return { pass: leaks.length === 0 && failed.length === 0 && peopleSeen, detail: leaks.length > 0 ? leaks.join('；') : `${bodies.length} 份响应里搜不到两个人的身份码（人名在里面=${peopleSeen}）${failed.length > 0 ? `；没打开的：${failed.join('、')}` : ''}` }
    })

    if (mode === 'start') {
      // 协作服务端代码里才有的原话：写入 action 的报错、在本机打开 repo: 链接的报错
      await check('浏览器产物里没有协作的服务端代码', async () => serverCodeInClientBuild(siteDir, ['node:fs', 'node:child_process', '认不出 intent', '运行 VS Code 的 code 命令失败', 'DOCSITE_IDENTITY_CODE']))
    }
  } finally {
    await context.close()
  }
  results.push(...problemResults(problems.filter((line) => !isExpectedRejection(line, runRecords.module.id))))
  return results
}

/** 「写入规则拒绝」那一项故意让 action 回 422：那次请求与浏览器为它打的那行控制台报错不算问题 */
function isExpectedRejection(line, rejectedModuleId) {
  const rejectedRequest = line.startsWith('[collab http 422] ') && line.endsWith(`/tasks/${rejectedModuleId}.data`)
  const consoleLineForIt = line.startsWith('[collab console.error] Failed to load resource') && line.includes('status of 422')
  return rejectedRequest || consoleLineForIt
}
