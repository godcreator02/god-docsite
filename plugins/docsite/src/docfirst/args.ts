import fs from 'node:fs'
import path from 'node:path'
import { isSiteAudience, siteAudiences, type SiteAudience } from '@godcreator/god-docsite'
import { isRecord } from './vocab.js'

/** docfirst.create 认的参数，多给一个键就报错 */
const CREATE_ARG_KEYS = ['dir', 'audience', 'title']

/** 校验过的建站参数 */
export interface CreateArgs {
  siteDir: string
  repoDir: string
  audience: SiteAudience
  title?: string
}

export type ParsedCreateArgs = { ok: true; args: CreateArgs } | { ok: false; error: string }

/**
 * docfirst.create 的参数 `{ dir, audience, title? }` 是外部输入。站目录要绝对路径：插件运行在工作台主进程里，
 * 不知道该相对于哪个目录。站目录还不能存在由建站器检查，这里只查它的上一级（仓目录）在不在。
 */
export function parseCreateArgs(command: string, raw: unknown): ParsedCreateArgs {
  const shape = `${command} 要 { dir: string, audience: ${siteAudiences.map((value) => `"${value}"`).join(' | ')}, title?: string }`
  if (!isRecord(raw)) return { ok: false, error: `${shape}，给的不是对象` }
  const unknownKeys = Object.keys(raw).filter((key) => !CREATE_ARG_KEYS.includes(key))
  if (unknownKeys.length > 0) return { ok: false, error: `${shape}，不认识的参数：${unknownKeys.join('、')}` }

  const dir = raw['dir']
  if (typeof dir !== 'string' || dir.trim() === '') return { ok: false, error: `${shape}，dir 是站目录的绝对路径` }
  if (!path.isAbsolute(dir)) return { ok: false, error: `dir 要是绝对路径（这里不知道该相对于哪个目录），给的是：${dir}` }
  const siteDir = path.resolve(dir)
  const repoDir = path.dirname(siteDir)
  if (fs.statSync(repoDir, { throwIfNoEntry: false })?.isDirectory() !== true) {
    return { ok: false, error: `站目录的上一级要是已经存在的仓目录，没有这个目录：${repoDir}` }
  }

  const audience = raw['audience']
  if (!isSiteAudience(audience)) return { ok: false, error: `${shape}，audience 写这个站给谁看：只有自己在本机看写 personal，别人也会 clone 下来看（代码仓的文档站多是这种）写 shared` }

  const title = raw['title']
  if (title !== undefined && (typeof title !== 'string' || title.trim() === '')) return { ok: false, error: `${shape}，title 给了就要是非空字符串` }

  return { ok: true, args: { siteDir, repoDir, audience, ...(title === undefined ? {} : { title: title.trim() }) } }
}
