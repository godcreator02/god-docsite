import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { PORT_FROM, PORT_TO, pickPort, portsInScript, scanUsedPorts } from '../src/ports.js'

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

describe('portsInScript：按脚本里的端口参数认，不按目录名、不按启动的是什么认', () => {
  it('next 的 -p：dev 与 start 都认，-H 跟在后面照认', () => {
    expect(portsInScript('next dev -p 4310')).toEqual([4310])
    expect(portsInScript('next start -p 4399 -H 127.0.0.1')).toEqual([4399])
  })
  it('vite 的 --port：-p 之外的写法也认，参数排在 --host 前后都行', () => {
    expect(portsInScript('vite --port 4330 --host 127.0.0.1')).toEqual([4330])
    expect(portsInScript('vite preview --host 127.0.0.1 --port 4331')).toEqual([4331])
  })
  it('等号写法 --port=N 与 -p=N 也认', () => {
    expect(portsInScript('vite --port=4332')).toEqual([4332])
    expect(portsInScript('next dev -p=4333')).toEqual([4333])
  })
  it('不是 next 也不是 vite 的服务照认——认多了只是跳过一个端口，认少了才会撞', () => {
    expect(portsInScript('node server.js -p 4310')).toEqual([4310])
  })
  it('一条脚本里起了几个服务，几个端口都认', () => {
    expect(portsInScript('concurrently "vite --port 4330" "next dev -p 4331"')).toEqual([4330, 4331])
    expect(portsInScript('next build && next start -p 4310')).toEqual([4310])
  })
  it('后面不是数字、或参数名只是以 -p / --port 开头的，都不认', () => {
    expect(portsInScript('next build')).toEqual([])
    expect(portsInScript('tsc -p tsconfig.json')).toEqual([])
    expect(portsInScript('mkdir -p dist')).toEqual([])
    expect(portsInScript('tool --portal 4310 --port-range 4320')).toEqual([])
    expect(portsInScript('tool --no-p 4310')).toEqual([])
  })
})

describe('scanUsedPorts：深四层，跳过 node_modules 与点目录', () => {
  it('同级各仓占用的端口都扫得出来，值是占用它的那个目录', () => {
    put('repo-a/docs-site/package.json', site(4310))
    put('repo-b/website/package.json', site(4312))
    const { used, incomplete } = scanUsedPorts(tmp)
    expect([...used.keys()].sort((a, b) => a - b)).toEqual([4310, 4312])
    expect(used.get(4310)).toBe(path.join(tmp, 'repo-a', 'docs-site'))
    expect(incomplete).toEqual([])
  })

  it('单元里多套一层的 vite 站（第四层）扫得出来，next 与 vite 的端口一起算占用', () => {
    put('unit-a/repo/docs-site/package.json', site(4310))
    put('unit-b/hybrid-mmc/collab/site/package.json', JSON.stringify({ scripts: { dev: 'vite --port 4330 --host 127.0.0.1' } }))
    const { used } = scanUsedPorts(tmp)
    expect([...used.keys()].sort((a, b) => a - b)).toEqual([4310, 4330])
    expect(used.get(4330)).toBe(path.join(tmp, 'unit-b', 'hybrid-mmc', 'collab', 'site'))
  })

  it('node_modules 与点目录里的不算', () => {
    put('repo/node_modules/pkg/package.json', site(4310))
    put('repo/.next/package.json', site(4311))
    expect(scanUsedPorts(tmp).used.size).toBe(0)
  })

  it('第五层不扫；坏 JSON、读不动的目录都不中断扫描', () => {
    put('a/b/c/d/e/package.json', site(4310))
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
