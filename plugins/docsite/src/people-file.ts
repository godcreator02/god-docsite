import { randomInt } from 'node:crypto'
import { identityCodePattern, type JoiningPerson } from '@godcreator/identity'
import { joinSitePeople } from '@godcreator/identity/node'
import { DocsiteRejected } from './errors.js'

const codeAlphabet = 'abcdefghijkmnpqrstuvwxyz23456789'

/** 新的身份码：12 个小写字母与数字，去掉容易看错的 l、o、0、1 */
export function newIdentityCode(): string {
  return Array.from({ length: 12 }, () => codeAlphabet[randomInt(codeAlphabet.length)]).join('')
}

export function isIdentityCode(value: unknown): value is string {
  return typeof value === 'string' && identityCodePattern.test(value)
}

/**
 * 把本 home 的码加进站点的 people.json（identity 包的 joinSitePeople：已有这个 id 就加进它的 codes，没有就新加一项；
 * 码已经在里面就不改文件；一项一行写回）。文件读不出、码已在别人名下这类拒绝原样报出来
 */
export async function joinPeople(siteDir: string, code: string, person: JoiningPerson): Promise<{ changed: boolean }> {
  try {
    return await joinSitePeople(siteDir, code, person)
  } catch (error) {
    throw new DocsiteRejected(error instanceof Error ? error.message : String(error))
  }
}
