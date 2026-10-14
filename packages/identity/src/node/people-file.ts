import { existsSync, readFileSync } from 'node:fs'
import { writeFile } from 'node:fs/promises'
import path from 'node:path'
import { parsePeople, peopleFile, peopleWithJoined, type JoiningPerson, type StoredPerson } from '../core/people.js'

/** 读一个 JSON 文件；文件不在时报 missing 这句话 */
function jsonFileOf(file: string, missing: string): unknown {
  if (!existsSync(file)) throw new Error(missing)
  try {
    return JSON.parse(readFileSync(file, 'utf8')) as unknown
  } catch (error) {
    throw new Error(`${file} 不是 JSON：${String(error)}`)
  }
}

/** 站点人员列表：站点目录里的 people.json，每次都重新读，改了不用重启服务 */
export function sitePeople(siteDir: string): StoredPerson[] {
  const file = path.join(siteDir, peopleFile)
  return parsePeople(jsonFileOf(file, `站点目录里没有 ${peopleFile}：写一个数组列出参与的人，每项 { "id": "zhou", "name": "小周", "codes": ["<身份码>"] }，agent 加 "agent": true`))
}

/** people.json 的写法：一项一行，加一个人或一个码时 git 里的改动只有那一行 */
export function peopleFileText(people: readonly StoredPerson[]): string {
  return `[\n${people.map((person) => `  ${JSON.stringify(person)}`).join(',\n')}\n]\n`
}

/** 写回站点的 people.json；写之前按 parsePeople 校验，写不进不合法的列表 */
export async function writeSitePeople(siteDir: string, people: readonly StoredPerson[]): Promise<void> {
  await writeFile(path.join(siteDir, peopleFile), peopleFileText(parsePeople(people)))
}

/** 把本机的码加进站点的人员列表（规则见 peopleWithJoined）；码已经在那个人名下时不动文件，changed 为 false */
export async function joinSitePeople(siteDir: string, code: string, joining: JoiningPerson): Promise<{ changed: boolean }> {
  const people = sitePeople(siteDir)
  const joined = peopleWithJoined(people, code, joining)
  if (JSON.stringify(joined) === JSON.stringify(people)) return { changed: false }
  await writeSitePeople(siteDir, joined)
  return { changed: true }
}
