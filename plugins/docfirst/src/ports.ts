import fs from 'node:fs'
import path from 'node:path'
import { isRecord } from './vocab.js'

/**
 * 端口：别的站占了哪些、新站用哪个。只读文件系统，能单测（tests/ports.test.ts）。
 *
 * **按脚本内容认，不按目录名认**：站不一定叫 `docs-site`，认的是 `package.json` 的 scripts 里
 * `next dev -p <端口>` / `next start -p <端口>` 这样的命令。
 */

/** 端口从这一段里找。4310–4399 留给文档站 */
export const PORT_FROM = 4310
export const PORT_TO = 4399

/** 扫描时没读成的一处：目录列不出内容，或 package.json 读不出、不是 JSON 对象 */
export interface PortScanProblem {
  path: string
  reason: string
}

/** 扫描结果：已占用的端口 → 占用它的目录；没读成的地方单独列出，由调用方写进回执 */
export interface PortScan {
  used: Map<number, string>
  incomplete: PortScanProblem[]
}

/** 从一条脚本里认出它指定的端口，认不出回 undefined */
export function portInScript(command: string): number | undefined {
  const hit = /\bnext\s+(?:dev|start)\b[^&|]*?-p\s+(\d{2,5})/.exec(command)
  return hit === null ? undefined : Number(hit[1])
}

function reasonOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

/**
 * 扫描给定目录下深三层内的每一份 package.json，找出别的站已占用的端口。跳过 node_modules 与点目录。
 * 读不成的目录或文件不让建站失败，也不静默跳过：记进 `incomplete`，回执里告诉人查重不完整。
 */
export function scanUsedPorts(root: string): PortScan {
  const used = new Map<number, string>()
  const incomplete: PortScanProblem[] = []

  const readManifest = (dir: string, file: string): void => {
    let parsed: unknown
    try {
      parsed = JSON.parse(fs.readFileSync(file, 'utf8'))
    } catch (error) {
      incomplete.push({ path: file, reason: reasonOf(error) })
      return
    }
    if (!isRecord(parsed)) {
      incomplete.push({ path: file, reason: '不是 JSON 对象' })
      return
    }
    const scripts = parsed['scripts']
    if (!isRecord(scripts)) return
    for (const command of Object.values(scripts)) {
      if (typeof command !== 'string') continue
      const port = portInScript(command)
      if (port !== undefined) used.set(port, dir)
    }
  }

  const visit = (dir: string, depth: number): void => {
    if (depth > 3) return
    let entries: fs.Dirent[]
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true })
    } catch (error) {
      incomplete.push({ path: dir, reason: reasonOf(error) })
      return
    }
    for (const entry of entries) {
      if (entry.isDirectory()) {
        if (entry.name === 'node_modules' || entry.name.startsWith('.')) continue
        visit(path.join(dir, entry.name), depth + 1)
      } else if (entry.name === 'package.json') {
        readManifest(dir, path.join(dir, entry.name))
      }
    }
  }

  visit(root, 0)
  return { used, incomplete }
}

/**
 * 选一个端口。**调用方给了就用给的**，被占用也只在回执里说明，不替人改：
 * 占用它的那个站可能早就不运行了。没给就从 4310 起找第一个空闲的。
 */
export function pickPort(used: Iterable<number> | Map<number, string>, prefer?: number): number {
  if (prefer !== undefined) return prefer
  const taken = used instanceof Map ? new Set(used.keys()) : new Set(used)
  for (let port = PORT_FROM; port <= PORT_TO; port += 1) {
    if (!taken.has(port)) return port
  }
  throw new Error(`${String(PORT_FROM)}–${String(PORT_TO)} 全被占了，自己给一个 port`)
}
