// 站点重启后已经打开的页面还收不收得到推送。
// node probe.mjs setup | start [n] | restart [n] | push <n> | kill
// setup 在系统临时目录搭一个最小的项目站点；start / restart 照 gwb-collab 的 launchSite + pushLatestFeed：
// 用环境变量交身份与口令运行开发服务，输出里一出现 Local: 就推一份带 n 条通知的数据。
// 页面上提示栏写「协作仓 n 件事」，看这个数就知道页面拿到的是哪一份。
import { spawn, spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, openSync, readFileSync, realpathSync, symlinkSync, writeFileSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))
const repo = path.resolve(here, '../..')
const sitePackage = path.join(repo, 'packages/collab-site')
const work = path.join(os.tmpdir(), 'collab-site-restart-probe')
const site = path.join(work, 'proj/collab/site')
const collabDir = path.join(work, 'proj/collab/collab')
const pidFile = path.join(work, 'server.pid')
const logFile = path.join(work, 'server.txt')
const port = 4391
const url = `http://127.0.0.1:${port}`
const token = 'probe-token'

function setup() {
  mkdirSync(path.join(site, 'pages/grp/hello'), { recursive: true })
  mkdirSync(path.join(collabDir, 'records'), { recursive: true })
  mkdirSync(path.join(site, 'node_modules/@godcreator'), { recursive: true })
  writeFileSync(path.join(site, 'index.html'), '<!doctype html>\n<html lang="zh-CN"><head><meta charset="UTF-8" /><title>probe</title></head><body></body></html>\n')
  writeFileSync(path.join(site, 'pages/_folder.json'), JSON.stringify({ title: '复现站', order: ['grp'] }))
  writeFileSync(path.join(site, 'pages/grp/_folder.json'), JSON.stringify({ title: '组', order: ['hello'] }))
  writeFileSync(path.join(site, 'pages/grp/hello/page.mdx'), "export const meta = { title: '你好' }\n\n# 你好\n\n一段正文。\n")
  writeFileSync(path.join(collabDir, 'people.json'), JSON.stringify([{ id: 'carol-test', name: '小李' }]) + '\n')
  // 站点的依赖指到仓里网站包装好的那几份：网站包本身、页面直接 import 的 react、react-dom，以及预构建要的 react-router
  const links = {
    '@godcreator/collab-site': sitePackage,
    react: realpathSync(path.join(sitePackage, 'node_modules/react')),
    'react-dom': realpathSync(path.join(sitePackage, 'node_modules/react-dom')),
    'react-router': realpathSync(path.join(sitePackage, 'node_modules/react-router')),
  }
  for (const [name, target] of Object.entries(links)) {
    const at = path.join(site, 'node_modules', name)
    if (!existsSync(at)) symlinkSync(target, at, 'junction')
  }
  console.log('站点目录', site)
}

async function serve() {
  const { createServer } = await import(pathToFileURL(path.join(realpathSync(path.join(sitePackage, 'node_modules/vite')), 'dist/node/index.js')).href)
  const { collab } = await import(pathToFileURL(path.join(sitePackage, 'dist/dev-server/index.js')).href)
  const server = await createServer({
    root: site,
    configFile: false,
    cacheDir: path.join(work, 'vite-cache'),
    plugins: [collab()],
    server: { port, host: '127.0.0.1', strictPort: true, fs: { allow: [work, repo] } },
  })
  await server.listen()
  server.printUrls()
}

function kill() {
  if (!existsSync(pidFile)) return
  const pid = readFileSync(pidFile, 'utf8').trim()
  const result = spawnSync('taskkill', ['/PID', pid, '/T', '/F'], { encoding: 'utf8' })
  console.log(new Date().toISOString(), 'kill', pid, (result.stdout || result.stderr).trim())
}

async function push(count) {
  const notifications = Array.from({ length: count }, (_, i) => ({ id: `check-error-${i}`, kind: 'check-error', message: `第 ${i} 条` }))
  const response = await fetch(`${url}/__collab/feed`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-collab-token': token },
    body: JSON.stringify({ notifications, projectLeads: ['carol-test'] }),
  })
  console.log(new Date().toISOString(), 'push', count, response.status, await response.text())
}

async function start(count) {
  writeFileSync(logFile, '')
  const log = openSync(logFile, 'a')
  const child = spawn(process.execPath, [fileURLToPath(import.meta.url), 'serve'], {
    detached: true,
    stdio: ['ignore', log, log],
    env: { ...process.env, COLLAB_PERSON: 'carol-test', COLLAB_FEED_TOKEN: token },
  })
  child.unref()
  writeFileSync(pidFile, String(child.pid))
  const deadline = Date.now() + 60_000
  while (!/Local:/.test(readFileSync(logFile, 'utf8'))) {
    if (Date.now() > deadline) throw new Error(`60 秒内没报出地址：\n${readFileSync(logFile, 'utf8')}`)
    await new Promise((resolve) => setTimeout(resolve, 50))
  }
  console.log(new Date().toISOString(), 'started', child.pid, url)
  if (count !== undefined) await push(count)
}

const [command, countText] = process.argv.slice(2)
const count = countText === undefined ? undefined : Number(countText)
if (command === 'setup') setup()
else if (command === 'serve') await serve()
else if (command === 'start') await start(count)
else if (command === 'restart') {
  kill()
  await start(count)
} else if (command === 'push') await push(count)
else if (command === 'kill') kill()
else throw new Error(`不认识的命令 ${command}：只认 setup、start、restart、push、kill`)
