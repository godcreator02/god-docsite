#!/usr/bin/env node
/**
 * docsite-serve：站点发布版的启动命令（站点 package.json 的 scripts.start）。没设 PORT 就随机挑一个空闲的五位数端口设上，
 * 再用站点装的 react-router-serve 启动，参数原样转交；站点按 PORT 认写入请求的来源，发布版本身只读
 */
import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import path from 'node:path'
import { randomFreePort } from '../node/free-port.js'

const serveBin = path.join(process.cwd(), 'node_modules', '@react-router', 'serve', 'bin.cjs')
if (!existsSync(serveBin)) {
  console.error(`docsite-serve：${process.cwd()} 里找不到 @react-router/serve（${serveBin}），在站点目录里运行，并先 pnpm install`)
  process.exit(1)
}
const port = process.env['PORT'] || String(await randomFreePort())
const child = spawn(process.execPath, [serveBin, ...process.argv.slice(2)], { stdio: 'inherit', env: { ...process.env, PORT: port } })
child.on('exit', (code) => process.exit(code ?? 1))
