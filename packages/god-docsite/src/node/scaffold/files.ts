import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, statSync } from 'node:fs'
import path from 'node:path'

/** 目录下的全部文件，相对这个目录、用正斜杠，按路径排序 */
export function filesUnder(dir: string): string[] {
  const walk = (current: string, prefix: string): string[] =>
    readdirSync(current).flatMap((entry) => {
      const full = path.join(current, entry)
      const relative = prefix === '' ? entry : `${prefix}/${entry}`
      return statSync(full).isDirectory() ? walk(full, relative) : [relative]
    })
  return walk(dir, '').sort()
}

export function toPosixPath(file: string): string {
  return file.replaceAll('\\', '/')
}

export function readJsonFile(file: string): unknown {
  const text = readFileSync(file, 'utf8')
  try {
    return JSON.parse(text) as unknown
  } catch (error) {
    throw new Error(`${file} 不是合法的 JSON：${error instanceof Error ? error.message : String(error)}`)
  }
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export interface CopiedFiles {
  /** 这次复制进去的文件（相对目标目录） */
  added: string[]
  /** 目标里已经有、没动的文件 */
  kept: string[]
}

/** 把 fromDir 下的文件复制到 toDir，目标已有的文件不覆盖（站点里的文件可能被用户改过） */
export function copyMissingFiles(fromDir: string, toDir: string): CopiedFiles {
  const copied: CopiedFiles = { added: [], kept: [] }
  for (const relative of filesUnder(fromDir)) {
    const target = path.join(toDir, relative)
    if (existsSync(target)) {
      copied.kept.push(relative)
      continue
    }
    mkdirSync(path.dirname(target), { recursive: true })
    copyFileSync(path.join(fromDir, relative), target)
    copied.added.push(relative)
  }
  return copied
}
