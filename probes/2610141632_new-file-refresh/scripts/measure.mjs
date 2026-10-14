// 测量：dev 运行中新写入一个内容文件，到「新地址返回 200」「已打开的页面里出现它」各要多久。
// 用法：node scripts/measure.mjs [--variants a,b] [--sizes small,large] [--reps 10]
// 结果写 results/<方案>.<规模>.json，dev 日志写 results/logs/
import { execFileSync, spawn } from 'node:child_process'
import { watch } from 'node:fs'
import { mkdir, rm, unlink, writeFile } from 'node:fs/promises'
import { createWriteStream } from 'node:fs'
import path from 'node:path'
import readline from 'node:readline'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright-core'

const probeDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const resultsDir = path.join(probeDir, 'results')
const port = 5610
const origin = `http://127.0.0.1:${port}`
const contentDirs = ['content/docs', 'journal', 'comments']

const variants = {
  'original': { root: 'original', fix: 'none', timeoutMs: 10_000 },
  'A-vite-patch': { root: 'patched', fix: 'none', timeoutMs: 10_000 },
  'B-rewrite-base': { root: 'original', fix: 'rewrite', timeoutMs: 10_000 },
  'C-hot-update': { root: 'original', fix: 'hotupdate', timeoutMs: 10_000 },
  'C+full-reload': { root: 'original', fix: 'hotupdate-reload', timeoutMs: 10_000 },
  'C+tree-id': { root: 'original', fix: 'hotupdate', treeKey: true, timeoutMs: 10_000 },
  'A+tree-id': { root: 'patched', fix: 'none', treeKey: true, timeoutMs: 10_000 },
  'D1-process-restart': { root: 'original', fix: 'none', processRestart: true, timeoutMs: 60_000 },
  'D2-vite-restart': { root: 'original', fix: 'restart', timeoutMs: 60_000 },
  'E-request-compile': { root: 'original', fix: 'none', requestCompile: true, timeoutMs: 10_000 },
}
const sizes = { small: 20, large: 300 }

const pageBody = (heading) => `## ${heading}

这是一段用来撑起页面体量的正文，内容与真实文档相当：几段文字、一张表、一段代码。

| 字段 | 说明 |
| --- | --- |
| id | 记录的编号，创建后不变 |
| title | 标题 |
| status | todo、doing、done 之一 |

\`\`\`ts
export function summarize(records: { status: string }[]) {
  const counts = new Map<string, number>()
  for (const record of records) counts.set(record.status, (counts.get(record.status) ?? 0) + 1)
  return Object.fromEntries(counts)
}
\`\`\`

### 小节

再来一段文字，让目录里有两级标题。
`

const kinds = {
  page: {
    watchUrl: '/docs',
    file: (id) => `content/docs/probe-${id}.mdx`,
    body: (id) => `---\ntitle: probe-title-${id}\n---\n\n${pageBody('新页面')}`,
    selector: (id) => `a[href="/docs/probe-${id}"]`,
    targetUrl: (id) => `/docs/probe-${id}`,
    marker: (id) => `probe-title-${id}`,
  },
  journal: {
    watchUrl: '/journal',
    file: (id) => `journal/probe-${id}.mdx`,
    body: (id) => `---\ntitle: journal-title-${id}\n---\n\n${pageBody('今天做了什么')}`,
    selector: (id) => `a[href="/journal/probe-${id}"]`,
    targetUrl: (id) => `/journal/probe-${id}`,
    marker: (id) => `journal-title-${id}`,
  },
  comment: {
    watchUrl: '/docs',
    file: (id) => `comments/probe-${id}.mdx`,
    body: (id) => `---\ntitle: 新评论\npage: index.mdx\nmarker: comment-${id}\n---\n\n评论正文。\n`,
    selector: (id) => `[data-comment-marker="comment-${id}"]`,
    targetUrl: () => '/docs',
    marker: (id) => `comment-${id}`,
  },
}
const requestCompileKinds = {
  page: {
    ...kinds.page,
    watchUrl: '/remote',
    selector: (id) => `a[href="/remote/probe-${id}"]`,
    targetUrl: (id) => `/remote/probe-${id}`,
  },
}

function parseArgs(argv) {
  const options = { variants: Object.keys(variants), sizes: Object.keys(sizes), reps: 10 }
  for (let index = 0; index < argv.length; index += 2) {
    const [flag, value] = [argv[index], argv[index + 1]]
    if (value === undefined) throw new Error(`参数 ${flag} 缺值`)
    if (flag === '--variants') options.variants = value.split(',')
    else if (flag === '--sizes') options.sizes = value.split(',')
    else if (flag === '--reps') options.reps = Number(value)
    else throw new Error(`认不出的参数 ${flag}；只接受 --variants、--sizes、--reps`)
  }
  for (const name of options.variants) if (!(name in variants)) throw new Error(`没有方案 ${name}；可选 ${Object.keys(variants).join('、')}`)
  for (const name of options.sizes) if (!(name in sizes)) throw new Error(`没有规模 ${name}；可选 ${Object.keys(sizes).join('、')}`)
  if (!Number.isInteger(options.reps) || options.reps < 1) throw new Error(`--reps 要是正整数，收到 ${options.reps}`)
  return options
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

async function prepareContent(rootDir, pageCount) {
  await rm(path.join(rootDir, 'content/docs/gen'), { recursive: true, force: true })
  await mkdir(path.join(rootDir, 'content/docs/gen'), { recursive: true })
  for (let index = 1; index <= pageCount; index++) {
    const name = String(index).padStart(3, '0')
    await writeFile(path.join(rootDir, `content/docs/gen/page-${name}.mdx`), `---\ntitle: 生成页 ${name}\n---\n\n${pageBody(`第 ${name} 页`)}`)
  }
  for (const dir of contentDirs) {
    const { readdir } = await import('node:fs/promises')
    for (const file of await readdir(path.join(rootDir, dir))) if (file.startsWith('probe-')) await rm(path.join(rootDir, dir, file))
  }
}

class DevServer {
  constructor(rootDir, variant, logFile) {
    this.rootDir = rootDir
    this.variant = variant
    this.events = []
    this.log = createWriteStream(logFile)
    this.child = null
  }

  start() {
    const child = spawn(process.execPath, ['node_modules/@react-router/dev/bin.cjs', 'dev', '--port', String(port), '--host', '127.0.0.1', '--strictPort'], {
      cwd: this.rootDir,
      env: {
        ...process.env,
        PROBE_FIX: this.variant.fix,
        PROBE_REQUEST_COMPILE: this.variant.requestCompile ? '1' : '0',
        PROBE_TREE_KEY: this.variant.treeKey ? '1' : '0',
        VITE_CONFIG_NATIVE_IGNORE_WARNING: 'true',
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    readline.createInterface({ input: child.stdout }).on('line', (line) => {
      this.log.write(`${line}\n`)
      if (line.startsWith('@@probe ')) this.events.push(JSON.parse(line.slice('@@probe '.length)))
    })
    readline.createInterface({ input: child.stderr }).on('line', (line) => this.log.write(`[stderr] ${line}\n`))
    this.child = child
  }

  stop() {
    if (this.child === null || this.child.exitCode !== null) return
    try {
      execFileSync('taskkill', ['/PID', String(this.child.pid), '/T', '/F'], { stdio: 'ignore' })
    } catch (error) {
      if (this.child.exitCode === null) throw error
    }
    this.child = null
  }

  restart() {
    this.events.push({ t: Date.now(), event: 'harness-restart' })
    this.stop()
    this.start()
  }
}

async function fetchText(url) {
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(15_000) })
    return { status: response.status, text: await response.text() }
  } catch {
    return { status: 0, text: '' }
  }
}

async function waitUntilServing(timeoutMs) {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    if ((await fetchText(`${origin}/docs`)).status === 200) return
    await sleep(100)
  }
  throw new Error(`开发服务 ${timeoutMs} 毫秒内没有就绪`)
}

async function pollUntilMarker(url, marker, present, timeoutMs) {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    const { status, text } = await fetchText(url)
    if (present ? status === 200 && text.includes(marker) : status !== 0 && !text.includes(marker)) return Date.now()
    await sleep(50)
  }
  return null
}

function watchContentForProcessRestart(rootDir, server) {
  let pending = null
  const watchers = contentDirs.map((dir) =>
    watch(path.join(rootDir, dir), { recursive: true }, (eventType, file) => {
      if (eventType !== 'rename' || file === null || file.startsWith('gen')) return
      clearTimeout(pending)
      pending = setTimeout(() => server.restart(), 50)
    }),
  )
  return () => watchers.forEach((watcher) => watcher.close())
}

async function measureOnce({ page, server, rootDir, kind, id, variant }) {
  await page.goto(origin + kind.watchUrl, { waitUntil: 'load', timeout: 60_000 })
  await sleep(800)
  const filePath = path.join(rootDir, kind.file(id))
  const t0 = Date.now()
  await writeFile(filePath, kind.body(id))
  const [domAt, httpAt] = await Promise.all([
    page.waitForSelector(kind.selector(id), { state: 'attached', timeout: variant.timeoutMs }).then(
      () => Date.now(),
      () => null,
    ),
    pollUntilMarker(origin + kind.targetUrl(id), kind.marker(id), true, variant.timeoutMs),
  ])
  let showsAfterManualReload = null
  if (domAt === null) {
    // 重启类方案里浏览器可能正在自己重连刷新，所以用等待式检查，不用一次性的 page.$
    showsAfterManualReload = await page
      .reload({ waitUntil: 'load', timeout: 60_000 })
      .then(() => page.waitForSelector(kind.selector(id), { state: 'attached', timeout: 5_000 }))
      .then(
        () => true,
        () => false,
      )
  }
  const relative = (at) => (at === null ? null : at - t0)
  const eventsAfter = server.events.filter((event) => event.t >= t0)
  const firstAt = (name) => eventsAfter.find((event) => event.event === name)?.t ?? null
  const record = {
    id,
    watcherAddMs: relative(firstAt('watcher-add') ?? firstAt('harness-restart')),
    hotSends: eventsAfter.filter((event) => event.event === 'hot-send').slice(0, 6).map((event) => ({ ms: event.t - t0, environment: event.environment, type: event.type })),
    hotUpdateModuleCounts: eventsAfter.filter((event) => event.event === 'hot-update' && event.type === 'create').map((event) => `${event.environment}:${event.moduleIds.length}`),
    httpMs: relative(httpAt),
    domMs: relative(domAt),
    showsAfterManualReload,
  }
  await unlink(filePath)
  await pollUntilMarker(origin + kind.targetUrl(id), kind.marker(id), false, variant.timeoutMs)
  if (variant.processRestart || variant.fix === 'restart') await waitUntilServing(120_000)
  await sleep(1000)
  return record
}

async function runVariant(browser, variantName, sizeName, reps) {
  const variant = variants[variantName]
  const rootDir = path.join(probeDir, '.work', variant.root)
  await prepareContent(rootDir, sizes[sizeName])
  const server = new DevServer(rootDir, variant, path.join(resultsDir, 'logs', `${variantName}.${sizeName}.dev.log`))
  const startedAt = Date.now()
  server.start()
  await waitUntilServing(180_000)
  const startupMs = Date.now() - startedAt
  const stopWatching = variant.processRestart ? watchContentForProcessRestart(rootDir, server) : () => {}
  const page = await browser.newPage()
  page.on('console', (message) => server.log.write(`[browser ${Date.now()}] ${message.type()}: ${message.text()}\n`))
  page.on('framenavigated', (frame) => frame === page.mainFrame() && server.log.write(`[browser ${Date.now()}] navigated ${frame.url()}\n`))
  const kindsToRun = variant.requestCompile ? requestCompileKinds : kinds
  // 预热：每个观察页先开一次，让首屏编译不算进第一轮
  for (const kind of Object.values(kindsToRun)) await page.goto(origin + kind.watchUrl, { waitUntil: 'load', timeout: 120_000 })
  const records = {}
  try {
    for (const [kindName, kind] of Object.entries(kindsToRun)) {
      records[kindName] = []
      for (let rep = 1; rep <= reps; rep++) {
        const id = `${kindName}-${rep}-${Date.now().toString(36)}`
        const record = await measureOnce({ page, server, rootDir, kind, id, variant })
        records[kindName].push(record)
        console.log(`[${variantName} ${sizeName}] ${kindName} #${rep}: 文件监视 ${record.watcherAddMs}ms，新地址 200 ${record.httpMs}ms，已开页面出现 ${record.domMs}ms`)
      }
    }
  } finally {
    stopWatching()
    await page.close()
    server.stop()
  }
  const result = { variant: variantName, size: sizeName, pages: sizes[sizeName], reps, startupMs, measuredAt: new Date().toISOString(), records }
  await writeFile(path.join(resultsDir, `${variantName}.${sizeName}.json`), `${JSON.stringify(result, null, 2)}\n`)
}

const options = parseArgs(process.argv.slice(2))
await mkdir(path.join(resultsDir, 'logs'), { recursive: true })
const browser = await chromium.launch({ channel: 'msedge', headless: true })
try {
  for (const sizeName of options.sizes) for (const variantName of options.variants) await runVariant(browser, variantName, sizeName, options.reps)
} finally {
  await browser.close()
}
