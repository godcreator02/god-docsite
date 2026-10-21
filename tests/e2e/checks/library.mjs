import { execFileSync } from 'node:child_process'
import { existsSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { checkRunner, hasViteErrorOverlay, headingOf, markNoReload, problemResults, stepTimeoutMs, stillNoReload, waitForHydrated, watchPage, writeThreadAndReply } from '../lib/checks.mjs'
import { addedPaperOf, missingReferencePageOf, writeAddedPaper } from '../lib/run-scratch.mjs'

/*
 * 测试站装的两个试验功能包（full-test/fixtures/ 的 fixture-papers、fixture-notes）：侧栏分区、外部 mdx 页与它的评论、
 * 跨功能包的引用（笔记的外部页里引用论文）、自包含检查。条目数据在站点目录的 fixture-papers/、fixture-notes/ 里：
 * 内容页 library-demo 引用笔记 A 与论文 A，笔记 A 引用论文 B；论文 C 只被没人引用的笔记 B 引用、另在笔记 A 的代码块里当例子写过
 */

/** 侧栏里的站内链接：地址到文字 */
async function sidebarLinksOf(page) {
  return page.locator('#nd-sidebar a[href]').evaluateAll((links) => links.map((link) => [link.getAttribute('href'), link.textContent?.trim() ?? '']))
}

/** 站点自己那一版的 docsite-check：退出码与输出 */
function runDocsiteCheck(siteDir) {
  const cli = path.join(siteDir, 'node_modules', '@godcreator', 'god-docsite', 'dist', 'cli', 'check.mjs')
  try {
    return { code: 0, output: execFileSync(process.execPath, [cli], { cwd: siteDir, encoding: 'utf8', stdio: 'pipe' }) }
  } catch (error) {
    if (typeof error.status !== 'number') throw error
    return { code: error.status, output: `${error.stdout ?? ''}${error.stderr ?? ''}` }
  }
}

/** 评论目录里串头正文带这段文字的那一串的串头文件 */
function threadHeadWith(siteDir, text) {
  const commentsDir = path.join(siteDir, 'comments')
  const found = readdirSync(commentsDir)
    .map((name) => path.join(commentsDir, name, 'index.mdx'))
    .find((file) => existsSync(file) && readFileSync(file, 'utf8').includes(text))
  if (found === undefined) throw new Error(`${commentsDir} 里没有正文带「${text}」的串`)
  return readFileSync(found, 'utf8')
}

export async function runLibraryChecks({ browser, baseUrl, mode, siteDir, runTag }) {
  const results = []
  const problems = []
  const check = checkRunner(results)
  const context = await browser.newContext({ viewport: { width: 1400, height: 900 } })
  try {
    const page = await context.newPage()
    watchPage(page, 'library', problems)

    await check('「试验论文」分区：只列从内容页走得到的引用（内容页引的 A、笔记 A 的外部页里引的 B），没被走到的 C 不列，最上面是「检索」', async () => {
      await page.goto(`${baseUrl}/fixture-papers/paper-b`, { waitUntil: 'load' })
      await waitForHydrated(page, '#nd-sidebar a[href="/fixture-papers"]')
      const links = await sidebarLinksOf(page)
      const shown = links.filter(([href]) => href.startsWith('/fixture-papers'))
      const expected = [
        ['/fixture-papers', '检索'],
        ['/fixture-papers/paper-a', '试验论文 A'],
        ['/fixture-papers/paper-b', '试验论文 B'],
      ]
      return { pass: JSON.stringify(shown) === JSON.stringify(expected), detail: `侧栏里的论文分区：${JSON.stringify(shown)}` }
    })

    await check('「试验笔记」分区：几页的笔记是一组、首页是第一项；没人引用的笔记 B 不列', async () => {
      await page.goto(`${baseUrl}/fixture-notes/note-a/p02`, { waitUntil: 'load' })
      await waitForHydrated(page, '#nd-sidebar a[href="/fixture-notes"]')
      const shown = (await sidebarLinksOf(page)).filter(([href]) => href.startsWith('/fixture-notes'))
      const expected = [
        ['/fixture-notes', '检索'],
        ['/fixture-notes/note-a', '引言'],
        ['/fixture-notes/note-a/p02', '推导'],
      ]
      return { pass: JSON.stringify(shown) === JSON.stringify(expected), detail: `侧栏里的笔记分区：${JSON.stringify(shown)}` }
    })

    await check('外部页：标题、正文、公式与条目文件夹里的图（经功能包的文件路由送出）', async () => {
      const response = await page.goto(`${baseUrl}/fixture-papers/paper-a`, { waitUntil: 'load' })
      const heading = await headingOf(page)
      const image = page.locator('img[src^="/fixture-papers-files/paper-a/assets/figure.svg"]')
      await image.waitFor({ timeout: stepTimeoutMs })
      const loaded = await image.evaluate((element) => element.complete && element.naturalWidth > 0)
      const katex = await page.locator('.katex').count()
      // 标题后面跟着「复制这一节的链接」按钮的文字
      const sections = await page.locator('h2').allTextContents()
      return {
        pass: response?.status() === 200 && heading === '试验论文 A' && loaded && katex >= 1 && ['方法', '结果'].every((name) => sections.some((text) => text.startsWith(name))),
        detail: `→ ${response?.status()}，h1=${heading}，图加载了=${loaded}，.katex ${katex} 个，h2 ${JSON.stringify(sections)}`,
      }
    })

    await check('跨功能包的引用：笔记的外部页里写的 <FixturePaper> 照常显示；代码块里的例子原样显示', async () => {
      await page.goto(`${baseUrl}/fixture-notes/note-a`, { waitUntil: 'load' })
      const paperLink = await page.locator('a[data-fixture-paper="paper-b"]').getAttribute('href', { timeout: stepTimeoutMs })
      await page.goto(`${baseUrl}/fixture-notes/note-a/p02`, { waitUntil: 'load' })
      const code = (await page.locator('pre').first().textContent({ timeout: stepTimeoutMs })) ?? ''
      return { pass: paperLink === '/fixture-papers/paper-b' && code.includes('<FixturePaper id="paper-c" />'), detail: `笔记 A 首页里论文 B 的链接 ${paperLink}；推导页的代码块 ${JSON.stringify(code.trim())}` }
    })

    await check('「检索」页列出本站全部条目（含没进分区的论文 C）', async () => {
      await page.goto(`${baseUrl}/fixture-papers`, { waitUntil: 'load' })
      const titles = await page.locator('main li a').allTextContents()
      return { pass: ['试验论文 A', '试验论文 B', '试验论文 C'].every((title) => titles.includes(title)), detail: `检索页列的：${JSON.stringify(titles)}` }
    })

    if (mode === 'dev') {
      await check('dev 外部页评论：在论文页上写评论与回复，存进站点的 comments/、归属键是页面地址；全站评论页这一行显示论文标题', async () => {
        await page.goto(`${baseUrl}/fixture-papers/paper-a`, { waitUntil: 'load' })
        const threadText = `e2e 外部页评论 ${runTag}`
        await writeThreadAndReply(page, { threadText, replyText: `e2e 外部页回复 ${runTag}` })
        const head = threadHeadWith(siteDir, threadText)
        await page.goto(`${baseUrl}/comments`, { waitUntil: 'load' })
        const row = page.locator('main a[href="/fixture-papers/paper-a"]', { hasText: '试验论文 A' })
        await row.first().waitFor({ timeout: stepTimeoutMs })
        const keyWritten = head.includes('page: "/fixture-papers/paper-a"')
        return { pass: keyWritten, detail: `串头写着归属键 /fixture-papers/paper-a=${keyWritten}；全站评论页有指向论文页、写着标题的行` }
      })

      await check('dev 数据目录：库里加一条，打开着的检索页就地多出它，没有整页刷新', async () => {
        await page.goto(`${baseUrl}/fixture-papers`, { waitUntil: 'load' })
        await waitForHydrated(page, '#nd-sidebar a[href="/fixture-papers"]')
        await markNoReload(page)
        const added = addedPaperOf(siteDir, runTag)
        writeAddedPaper(siteDir, runTag)
        await page.locator('main li a', { hasText: added.title }).waitFor({ timeout: stepTimeoutMs })
        const kept = await stillNoReload(page)
        return { pass: kept, detail: `检索页出现「${added.title}」，没有整页刷新=${kept}` }
      })

      await check('dev 自包含检查：内容页引用了库里没有的一条，问题按钮列进「自包含」组，docsite-check 也报它；删掉后都消失', async () => {
        await page.goto(`${baseUrl}/library-demo`, { waitUntil: 'load' })
        await waitForHydrated(page, '#nd-sidebar a[href="/library-demo"]')
        const missing = missingReferencePageOf(siteDir, runTag)
        writeFileSync(missing.file, missing.text)
        const issuesButton = page.locator('[data-top-notices] [data-dev-issues] > button', { hasText: '个问题' })
        await issuesButton.waitFor({ timeout: stepTimeoutMs })
        await issuesButton.click()
        await page.locator('[data-dev-issue-group="self-contained"]', { hasText: missing.id }).waitFor({ timeout: stepTimeoutMs })
        const failed = runDocsiteCheck(siteDir)
        rmSync(missing.file)
        await page.locator('[data-dev-issues]').waitFor({ state: 'detached', timeout: stepTimeoutMs })
        const passed = runDocsiteCheck(siteDir)
        const overlay = await hasViteErrorOverlay(page)
        return {
          pass: failed.code === 1 && failed.output.includes(missing.id) && passed.code === 0 && !overlay,
          detail: `问题按钮列着 ${missing.id}；docsite-check 有缺项时退出码 ${failed.code}（报了它=${failed.output.includes(missing.id)}），删掉后 ${passed.code}；报错层=${overlay}`,
        }
      })
    }
  } finally {
    await context.close()
  }

  results.push(...problemResults(problems))
  return results
}
