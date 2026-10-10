import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { parsePeople, peopleFile, type Person } from '../people.js'

/** 读一个 JSON 文件；文件不在时报 missing 这句话 */
export function jsonFileOf(file: string, missing: string): unknown {
  if (!existsSync(file)) throw new Error(missing)
  try {
    return JSON.parse(readFileSync(file, 'utf8'))
  } catch (error) {
    throw new Error(`${file} 不是 JSON：${String(error)}`)
  }
}

/** 站点人员列表：站点目录里的 people.json，每次都重新读，改了不用重启开发服务 */
export function sitePeople(siteDir = process.cwd()): Person[] {
  const file = path.join(siteDir, peopleFile)
  return parsePeople(jsonFileOf(file, `站点目录里没有 ${peopleFile}：写一个数组列出参与的人，每项 { "id": "zhou", "name": "小周", "codes": ["<身份码>"] }，agent 加 "agent": true`))
}
