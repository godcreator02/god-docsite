// 在真实的 docsite-kit/docs-site 上测：dev 运行中新增正文页、新增轨迹卡，多久能打开、已打开的页面多久出现。
// 仓里挂着 vite 补丁，测到的就是方案 A 在真实站点上的表现（方案 C 的刷新路径与 A 相同）。
// 只往 content/future/spec/ 与 trajectory/ 写 probe-* 临时文件，每轮删掉，开始前与结束后各清一次残留；不改站点代码与配置。
// 用法：node scripts/measure-docs-site.mjs [--reps 10]
import { execFileSync, spawn } from 'node:child_process'
import { createWriteStream } from 'node:fs'
import { mkdir, readdir, rm, unlink, writeFile } from 'node:fs/promises'
import path from 'node:path'
import readline from 'node:readline'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright-core'

const probeDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const siteDir = path.resolve(probeDir, '../../docs-site')
const resultsDir = path.join(probeDir, 'results')
const port = 5620
const origin = `http://127.0.0.1:${port}`
const timeoutMs = 15_000
const probeFileDirs = ['content/future/spec', 'trajectory']

const kinds = {
  page: {
    watchUrl: '/future/spec/rename-explainer',
    file: (id) => `content/future/spec/probe-${id}.mdx`,
    body: (id) => `---\ntitle: probe-title-${id}\ndescription: 实验用临时页面\n---\n\n## 新页面\n\n一段正文。\n`,
    selector: (id) => `a[href="/future/spec/probe-${id}"]`,
    targetUrl: (id) => `/future/spec/probe-${id}`,
    marker: (id) => `probe-title-${id}`,
  },
  card: {
    watchUrl: '/future/spec/rename-explainer',
    file: (id) => `trajectory/probe-${id}.mdx`,
    body: (id) => `---\nborn-at: 2026-10-14T18:00\ntype: choice\nparent: [2026-09-03-god-live-doc]\nlabel: probe-card-${id}\n---\n\n## 背景\n\n实验用临时卡片。\n`,
    selector: null,
    targetUrl: (id) => `/trajectory/probe-${id}`,
    marker: (id) => `probe-card-${id}`,
  },
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

function parseReps(argv) {
  if (argv.length === 0) return 10
  if (argv[0] !== '--reps' || argv.length !== 2) throw new Error('只接受 --reps <正整数>')
  const reps = Number(argv[1])
  if (!Number.isInteger(reps) || reps < 1) throw new Error(`--reps 要是正整数，收到 ${argv[1]}`)
  return reps
}

async function removeLeftoverProbeFiles() {
  for (const dir of probeFileDirs) for (const file of await readdir(path.join(siteDir, dir))) if (file.startsWith('probe-')) await rm(path.join(siteDir, dir, file))
}

async function fetchText(url) {
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(30_000) })
    return { status: response.status, text: await response.text() }
  } catch {
    return { status: 0, text: '' }
  }
}

async function pollUntilMarker(url, marker, present, limitMs) {
  const deadline = Date.now() + limitMs
  while (Date.now() < deadline) {
    const { status, text } = await fetchText(url)
    if (present ? status === 200 && text.includes(marker) : status !== 0 && !text.includes(marker)) return Date.now()
    await sleep(50)
  }
  return null
}

const reps = parseReps(process.argv.slice(2))
await mkdir(path.join(resultsDir, 'logs'), { recursive: true })
await removeLeftoverProbeFiles()

const log = createWriteStream(path.join(resultsDir, 'logs', 'docs-site.dev.log'))
const startedAt = Date.now()
const child = spawn(process.execPath, ['node_modules/@react-router/dev/bin.cjs', 'dev', '--port', String(port), '--host', '127.0.0.1', '--strictPort'], {
  cwd: siteDir,
  env: { ...process.env, VITE_CONFIG_NATIVE_IGNORE_WARNING: 'true' },
  stdio: ['ignore', 'pipe', 'pipe'],
})
readline.createInterface({ input: child.stdout }).on('line', (line) => log.write(`${line}\n`))
readline.createInterface({ input: child.stderr }).on('line', (line) => log.write(`[stderr] ${line}\n`))

const browser = await chromium.launch({ channel: 'msedge', headless: true })
const records = {}
let startupMs = null
try {
  if ((await pollUntilMarker(`${origin}${kinds.page.watchUrl}`, '<html', true, 240_000)) === null) throw new Error('docs-site 的开发服务 240 秒内没有就绪')
  startupMs = Date.now() - startedAt
  const page = await browser.newPage()
  page.on('console', (message) => log.write(`[browser ${Date.now()}] ${message.type()}: ${message.text()}\n`))
  page.on('framenavigated', (frame) => frame === page.mainFrame() && log.write(`[browser ${Date.now()}] navigated ${frame.url()}\n`))
  await page.goto(origin + kinds.page.watchUrl, { waitUntil: 'load', timeout: 120_000 })
  await fetchText(`${origin}/trajectory/2026-10-13-collab-site-native-rewrite`)

  for (const [kindName, kind] of Object.entries(kinds)) {
    records[kindName] = []
    for (let rep = 1; rep <= reps; rep++) {
      const id = `${kindName}-${rep}-${Date.now().toString(36)}`
      await page.goto(origin + kind.watchUrl, { waitUntil: 'load', timeout: 120_000 })
      await sleep(800)
      const filePath = path.join(siteDir, kind.file(id))
      const t0 = Date.now()
      await writeFile(filePath, kind.body(id))
      const [domAt, httpAt] = await Promise.all([
        kind.selector === null
          ? Promise.resolve(null)
          : page.waitForSelector(kind.selector(id), { state: 'attached', timeout: timeoutMs }).then(
              () => Date.now(),
              () => null,
            ),
        pollUntilMarker(origin + kind.targetUrl(id), kind.marker(id), true, timeoutMs),
      ])
      let showsAfterManualReload = null
      if (kind.selector !== null && domAt === null) {
        showsAfterManualReload = await page
          .reload({ waitUntil: 'load', timeout: 120_000 })
          .then(() => page.waitForSelector(kind.selector(id), { state: 'attached', timeout: 5_000 }))
          .then(
            () => true,
            () => false,
          )
      }
      const record = { id, httpMs: httpAt === null ? null : httpAt - t0, domMs: domAt === null ? null : domAt - t0, showsAfterManualReload }
      records[kindName].push(record)
      console.log(`[docs-site] ${kindName} #${rep}: 新地址 200 ${record.httpMs}ms，已开页面出现 ${record.domMs}ms，手动刷新后出现 ${record.showsAfterManualReload}`)
      await unlink(filePath)
      await pollUntilMarker(origin + kind.targetUrl(id), kind.marker(id), false, timeoutMs)
      await sleep(1000)
    }
  }
} finally {
  await browser.close()
  if (child.exitCode === null) execFileSync('taskkill', ['/PID', String(child.pid), '/T', '/F'], { stdio: 'ignore' })
  await removeLeftoverProbeFiles()
}

const result = { variant: 'docs-site（仓里现状：vite 补丁 = 方案 A）', size: 'real', pages: null, reps, startupMs, measuredAt: new Date().toISOString(), records }
await writeFile(path.join(resultsDir, 'docs-site.real.json'), `${JSON.stringify(result, null, 2)}\n`)
