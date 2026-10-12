import { closeSync, lstatSync, mkdirSync, openSync, rmdirSync, unlinkSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { DocsiteRejected } from '../errors.js'
import type { PlannedFile } from './assemble.js'

/** Windows 保留的名字：con.x.txt 也非法，看第一个点之前的基名 */
const windowsReservedBaseNames = new Set([
  'con', 'prn', 'aux', 'nul',
  ...Array.from({ length: 9 }, (_, index) => `com${index + 1}`),
  ...Array.from({ length: 9 }, (_, index) => `lpt${index + 1}`),
])

/** 相对路径的每一段都要是 Windows 能写的文件名（模板可能在任意系统制作、在 Windows 用，按最严平台检查） */
function fileNameProblem(relativePath: string): string | null {
  for (const segment of relativePath.split('/')) {
    if (segment === '') return '路径里有空的段'
    if (/[<>:"|?*\u0000-\u001f]/.test(segment)) return `里有 Windows 不允许的字符：${segment}`
    if (segment.endsWith('.') || segment.endsWith(' ')) return `里有以点或空格结尾的段：${segment}`
    if (windowsReservedBaseNames.has((segment.split('.')[0] ?? '').toLowerCase())) return `里有 Windows 保留的名字：${segment}`
  }
  return null
}

/**
 * 把组装好的站点文件树一次写进空目录（或只有 package.json 的目录）。全程新建式写入：中途失败只回滚本次
 * 新建的文件与目录段，一个字节不覆盖预存在的东西（package.json 例外：预检保证目录里只有它，且它的 name 已并进新 manifest）
 */
export function writeSiteFiles(dir: string, files: readonly PlannedFile[]): void {
  for (const file of files) {
    const problem = fileNameProblem(file.relativePath)
    if (problem !== null) throw new DocsiteRejected(`要写的 ${file.relativePath} ${problem}`)
  }

  const createdFiles: string[] = []
  const createdDirs: string[] = []
  try {
    for (const file of files) {
      const target = path.join(dir, ...file.relativePath.split('/'))
      ensureDirChain(path.dirname(target), dir, createdDirs)
      if (file.relativePath === 'package.json') {
        // 唯一允许覆盖的文件：预检保证目标目录里只有它，且它的 name 已并进新 manifest
        try {
          unlinkSync(target)
        } catch (error) {
          if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error
        }
      }
      const fd = openSync(target, 'wx')
      createdFiles.push(target)
      try {
        writeFileSync(fd, file.content)
      } finally {
        closeSync(fd)
      }
    }
  } catch (error) {
    rollback(dir, createdFiles, createdDirs)
    throw new DocsiteRejected(`写站点文件失败（已回滚本次新建的文件）：${error instanceof Error ? error.message : String(error)}`)
  }
}

/** 建出站点根到 dirToEnsure 的目录链，登记本次新建的目录段（回滚只删这些，预存在的目录绝不删） */
function ensureDirChain(dirToEnsure: string, siteRoot: string, createdDirs: string[]): void {
  const relative = path.relative(siteRoot, dirToEnsure)
  const segments = relative === '' ? [] : relative.split(path.sep)
  if (segments.length > 0 && (segments[0] === '..' || path.isAbsolute(relative))) {
    throw new Error(`内部错误：要建的目录 ${dirToEnsure} 不在站点根 ${siteRoot} 里`)
  }
  let sawMissing = false
  if (!exists(siteRoot)) {
    sawMissing = true
    createdDirs.push(siteRoot)
  }
  let current = siteRoot
  for (const segment of segments) {
    current = path.join(current, segment)
    if (sawMissing || !exists(current)) {
      sawMissing = true
      createdDirs.push(current)
    }
  }
  if (sawMissing) mkdirSync(dirToEnsure, { recursive: true })
}

function exists(entry: string): boolean {
  try {
    return lstatSyncOrNull(entry) !== null
  } catch {
    return false
  }
}

function lstatSyncOrNull(entry: string) {
  try {
    return lstatSync(entry)
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null
    throw error
  }
}

/** 失败后撤回本次新建的文件与目录段：文件逆序删，目录只删空的（rmdir 不递归），删不掉的进残留报告 */
function rollback(siteRoot: string, createdFiles: readonly string[], createdDirs: readonly string[]): void {
  const leftovers: string[] = []
  for (const file of [...createdFiles].reverse()) {
    try {
      unlinkSync(file)
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') leftovers.push(`${file}（删除失败：${error instanceof Error ? error.message : String(error)}）`)
    }
  }
  const byDepthDescending = (first: string, second: string) => second.split(path.sep).length - first.split(path.sep).length
  for (const dir of [...createdDirs].sort(byDepthDescending)) {
    try {
      rmdirSync(dir)
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT' && (error as NodeJS.ErrnoException).code !== 'ENOTEMPTY') {
        leftovers.push(`${dir}（目录非空或删除失败，保留）`)
      }
    }
  }
  if (leftovers.length > 0) throw new DocsiteRejected(`回滚后仍有残留，需要手动处理：${leftovers.join('；')}`)
}
