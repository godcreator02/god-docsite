import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { PORT_FROM, PORT_TO, pickPort, portInScript, scanUsedPorts } from '../src/ports.js'

/**
 * 别的站占用了哪些端口、新站选哪个：传入一个临时目录看输出，不启动进程、不打开真端口。
 */

let tmp: string
beforeEach(() => {
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'gwb-docfirst-ports-'))
})
afterEach(() => {
  fs.rmSync(tmp, { recursive: true, force: true })
})

function put(rel: string, text: string): void {
  const full = path.join(tmp, rel)
  fs.mkdirSync(path.dirname(full), { recursive: true })
  fs.writeFileSync(full, text)
}

function site(port: number): string {
  return JSON.stringify({ name: 'x', scripts: { dev: `next dev -p ${String(port)}`, start: `next start -p ${String(port)}` } })
}

describe('portInScript：按脚本内容认，不按目录名认', () => {
  it('dev 与 start 两种都认', () => {
    expect(portInScript('next dev -p 4310')).toBe(4310)
    expect(portInScript('next start -p 4399')).toBe(4399)
  })
  it('别的脚本不认——只有 next dev / next start 才是一个站在占用端口', () => {
    expect(portInScript('next build')).toBeUndefined()
    expect(portInScript('vite --port 4310')).toBeUndefined()
    expect(portInScript('node server.js -p 4310')).toBeUndefined()
  })
  it('只监听本机的脚本（-H 跟在 -p 后面）照认', () => {
    expect(portInScript('next dev -p 4310 -H 127.0.0.1')).toBe(4310)
    expect(portInScript('next start -p 4310 -H 127.0.0.1')).toBe(4310)
  })
  it('管道 / 与号之后那半不算同一条命令', () => {
    expect(portInScript('next build && echo -p 9999')).toBeUndefined()
  })
})

describe('scanUsedPorts：深三层，跳过 node_modules 与点目录', () => {
  it('同级各仓占用的端口都扫得出来，值是占用它的那个目录', () => {
    put('repo-a/docs-site/package.json', site(4310))
    put('repo-b/website/package.json', site(4312))
    const { used, incomplete } = scanUsedPorts(tmp)
    expect([...used.keys()].sort((a, b) => a - b)).toEqual([4310, 4312])
    expect(used.get(4310)).toBe(path.join(tmp, 'repo-a', 'docs-site'))
    expect(incomplete).toEqual([])
  })

  it('node_modules 与点目录里的不算', () => {
    put('repo/node_modules/pkg/package.json', site(4310))
    put('repo/.next/package.json', site(4311))
    expect(scanUsedPorts(tmp).used.size).toBe(0)
  })

  it('第四层不扫；坏 JSON、读不动的目录都不中断扫描', () => {
    put('a/b/c/d/package.json', site(4310))
    put('bad/package.json', '{ nope')
    expect(scanUsedPorts(tmp).used.size).toBe(0)
    expect(scanUsedPorts(path.join(tmp, 'nope')).used.size).toBe(0)
  })

  it('没读成的地方不静默跳过：坏 JSON、不是对象的 JSON、读不动的目录都列进 incomplete', () => {
    put('bad/package.json', '{ nope')
    put('null/package.json', 'null')
    put('ok/docs-site/package.json', site(4313))
    const { used, incomplete } = scanUsedPorts(tmp)
    expect([...used.keys()]).toEqual([4313])
    expect(incomplete.map((p) => p.path).sort()).toEqual([path.join(tmp, 'bad', 'package.json'), path.join(tmp, 'null', 'package.json')].sort())
    expect(incomplete.find((p) => p.path.endsWith(path.join('null', 'package.json')))?.reason).toBe('不是 JSON 对象')
    const missing = scanUsedPorts(path.join(tmp, 'nope')).incomplete
    expect(missing).toHaveLength(1)
    expect(missing[0]!.path).toBe(path.join(tmp, 'nope'))
    expect(missing[0]!.reason).toMatch(/ENOENT/)
  })
})

describe('pickPort：给了就用给的', () => {
  it('没给就从 4310 起找第一个空闲的', () => {
    expect(pickPort(new Set<number>())).toBe(PORT_FROM)
    expect(pickPort(new Set([4310, 4311]))).toBe(4312)
  })
  it('给了一定用它，被占用也照用——占用它的那个站可能早就不运行了', () => {
    expect(pickPort(new Set([4310]), 4310)).toBe(4310)
  })
  it('整段占满就抛，让人自己给一个', () => {
    const all = new Set<number>()
    for (let p = PORT_FROM; p <= PORT_TO; p += 1) all.add(p)
    expect(() => pickPort(all)).toThrow(/全被占了/)
  })
})
