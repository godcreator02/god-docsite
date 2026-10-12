import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { peopleFile, type Person } from '../model.js'

/**
 * 人员列表里一个人的存放形状：Person 加上这个人用过的身份码（每个 gwb home 一个）。
 * 只在服务端用；出服务端的先经 publicPersonOf 投影
 */
export type StoredPerson = Person & { codes?: string[] }

const personIdPattern = /^[\w-]+$/
/** 身份码的规则：8 到 64 个小写字母或数字。盘协议沿用既有约定，未改 */
export const identityCodePattern = /^[a-z0-9]{8,64}$/
const personKeys = ['id', 'name', 'codes', 'gitea', 'agent']

/** 校验 people.json 的内容：一个数组，每项 { id, name, codes?, gitea?, agent? }；id、码都不重复。写错时一次列出全部 */
export function parsePeople(value: unknown): StoredPerson[] {
  if (!Array.isArray(value)) throw new Error(`${peopleFile} 要是一个数组，每项写 { "id": "zhou", "name": "小周", "codes": ["<身份码>"] }`)
  const problems: string[] = []
  const seenIds = new Set<string>()
  const ownerOfCode = new Map<string, string>()
  value.forEach((item, index) => {
    const where = `${peopleFile} 第 ${index + 1} 项`
    if (typeof item !== 'object' || item === null || Array.isArray(item)) return problems.push(`${where} 要是 { "id": …, "name": … }`)
    const { id, name, codes, gitea, agent } = item as Record<string, unknown>
    for (const key of Object.keys(item)) if (!personKeys.includes(key)) problems.push(`${where}：认不出 ${key}，能写的只有 ${personKeys.join('、')}`)
    if (typeof id !== 'string' || !personIdPattern.test(id)) problems.push(`${where}：id 要是字母、数字、_、- 组成的字符串`)
    else if (seenIds.has(id)) problems.push(`${where}：id ${id} 和前面的重复了`)
    else seenIds.add(id)
    if (typeof name !== 'string' || name.trim() === '') problems.push(`${where}：name 要是非空字符串`)
    if (agent !== undefined && typeof agent !== 'boolean') problems.push(`${where}：agent 要是 true 或 false`)
    if (gitea !== undefined && (typeof gitea !== 'string' || gitea === '')) problems.push(`${where}：gitea 要是非空字符串`)
    if (codes === undefined) return
    if (agent === true) return problems.push(`${where}：agent 没有身份码，去掉 codes`)
    if (!Array.isArray(codes) || codes.length === 0) return problems.push(`${where}：codes 要是身份码的数组，至少一个`)
    for (const code of codes) {
      if (typeof code !== 'string' || !identityCodePattern.test(code)) problems.push(`${where}：身份码 ${String(code)} 要是 8 到 64 个小写字母或数字`)
      else if (ownerOfCode.has(code)) problems.push(`${where}：身份码 ${code} 已经写在 ${ownerOfCode.get(code)} 名下，一个码只能是一个人的`)
      else ownerOfCode.set(code, typeof id === 'string' ? id : `第 ${index + 1} 项`)
    }
  })
  if (problems.length > 0) throw new Error(problems.join('\n'))
  return value as StoredPerson[]
}

/**
 * 读站点目录里的 people.json：每次调用都重新读，改了不用重启服务。
 * 只负责盘协议；码从哪来、身份怎么解析由宿主决定（见 identity.ts）
 */
export function readPeopleFile(siteDir: string): StoredPerson[] {
  const file = path.join(siteDir, peopleFile)
  if (!existsSync(file)) throw new Error(`站点目录里没有 ${peopleFile}：写一个数组列出参与的人，每项 { "id": "zhou", "name": "小周", "codes": ["<身份码>"] }，agent 加 "agent": true`)
  try {
    return parsePeople(JSON.parse(readFileSync(file, 'utf8')))
  } catch (error) {
    if (error instanceof Error && error.message.startsWith(peopleFile)) throw error
    throw new Error(`${file} 不是 JSON：${String(error)}`)
  }
}
