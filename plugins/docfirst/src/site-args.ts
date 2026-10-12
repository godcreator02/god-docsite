import path from 'node:path'
import { isRecord } from './vocab.js'

export type ParsedSiteArgs<T> = { ok: true; args: T } | { ok: false; error: string }

/** 托管命令的参数都是外部输入：只认列出的键，dir 要绝对路径（插件运行在工作台主进程里，不知道相对于哪个目录） */
function parseKeys(command: string, raw: unknown, shape: string, keys: readonly string[]): ParsedSiteArgs<Record<string, unknown>> {
  const expected = `${command} 要 ${shape}`
  if (raw === undefined && keys.length === 0) return { ok: true, args: {} }
  if (!isRecord(raw)) return { ok: false, error: `${expected}，给的不是对象` }
  const unknownKeys = Object.keys(raw).filter((key) => !keys.includes(key))
  if (unknownKeys.length > 0) return { ok: false, error: `${expected}，不认识的参数：${unknownKeys.join('、')}` }
  return { ok: true, args: raw }
}

function siteDirOf(command: string, shape: string, raw: Record<string, unknown>): ParsedSiteArgs<string> {
  const dir = raw['dir']
  if (typeof dir !== 'string' || dir.trim() === '') return { ok: false, error: `${command} 要 ${shape}，dir 是站目录的绝对路径` }
  if (!path.isAbsolute(dir)) return { ok: false, error: `dir 要是绝对路径（这里不知道该相对于哪个目录），给的是：${dir}` }
  return { ok: true, args: path.resolve(dir) }
}

export function parseListArgs(command: string, raw: unknown): ParsedSiteArgs<Record<string, never>> {
  const parsed = parseKeys(command, raw, '{}', [])
  return parsed.ok ? { ok: true, args: {} } : parsed
}

/** add 与 remove：`{ dir }` */
export function parseSiteDirArgs(command: string, raw: unknown): ParsedSiteArgs<{ dir: string }> {
  const shape = '{ dir: string }'
  const parsed = parseKeys(command, raw, shape, ['dir'])
  if (!parsed.ok) return parsed
  const dir = siteDirOf(command, shape, parsed.args)
  return dir.ok ? { ok: true, args: { dir: dir.args } } : dir
}

/** restart：`{ dir, build? }`，build 不给就是 true */
export function parseRestartArgs(command: string, raw: unknown): ParsedSiteArgs<{ dir: string; build: boolean }> {
  const shape = '{ dir: string, build?: boolean }'
  const parsed = parseKeys(command, raw, shape, ['dir', 'build'])
  if (!parsed.ok) return parsed
  const dir = siteDirOf(command, shape, parsed.args)
  if (!dir.ok) return dir
  const build = parsed.args['build']
  if (build !== undefined && typeof build !== 'boolean') return { ok: false, error: `${command} 要 ${shape}，build 给了就要是 true 或 false` }
  return { ok: true, args: { dir: dir.args, build: build ?? true } }
}
