import { randomInt } from 'node:crypto'
import { readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { identityCodePattern, parsePeople, peopleFile, peopleWithJoined } from '@godcreator/docsite-kit/comments'
import { DocsiteRejected } from './errors.js'

const codeAlphabet = 'abcdefghijkmnpqrstuvwxyz23456789'

/** 新的身份码：12 个小写字母与数字，去掉容易看错的 l、o、0、1 */
export function newIdentityCode(): string {
  return Array.from({ length: 12 }, () => codeAlphabet[randomInt(codeAlphabet.length)]).join('')
}

export function isIdentityCode(value: unknown): value is string {
  return typeof value === 'string' && identityCodePattern.test(value)
}

export type JoiningPerson = { id: string; name: string; gitea?: string }

/**
 * 把本 home 的码加进站点的人员列表：已有这个 id 就加进它的 codes，没有就新加一项；码已经在里面就不改文件。
 * 写回时保持一项一行，git 里的改动只有这一行
 */
export async function joinPeople(siteDir: string, code: string, person: JoiningPerson): Promise<{ changed: boolean }> {
  const file = path.join(siteDir, peopleFile)
  let current: unknown
  try {
    current = JSON.parse(await readFile(file, 'utf8'))
  } catch (error) {
    throw new DocsiteRejected(`${file} 读不出：${error instanceof Error ? error.message : String(error)}`)
  }
  let people
  try {
    people = parsePeople(current)
  } catch (error) {
    throw new DocsiteRejected(error instanceof Error ? error.message : String(error))
  }
  const before = JSON.stringify(people)
  let joined
  try {
    joined = peopleWithJoined(people, code, person)
  } catch (error) {
    throw new DocsiteRejected(error instanceof Error ? error.message : String(error))
  }
  if (JSON.stringify(joined) === before) return { changed: false }
  await writeFile(file, `[\n${joined.map((each) => `  ${JSON.stringify(each)}`).join(',\n')}\n]\n`)
  return { changed: true }
}
