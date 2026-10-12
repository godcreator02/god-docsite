import { parsePeople as parsePeopleValue, type Person } from '@godcreator/docsite-kit/comments'
import { CollabFormatError } from './records.js'

export type { Person }

/**
 * 解析站点的 site/people.json：基础包的人员列表格式，每项 { id, name, codes?, gitea?, agent? }。
 * 协作站里 id 就是这个人的 Gitea 用户名，记录的 author、owner 写它；谁是负责人不记在这里，看 Gitea 上协作仓的协作者
 */
export function parsePeople(text: string): Person[] {
  let value: unknown
  try {
    value = JSON.parse(text)
  } catch (error) {
    throw new CollabFormatError(`site/people.json 不是合法 JSON：${error instanceof Error ? error.message : String(error)}`)
  }
  try {
    return parsePeopleValue(value)
  } catch (error) {
    throw new CollabFormatError(error instanceof Error ? error.message : String(error))
  }
}

/** 按人员 id 查人：nameOf 换成显示名（列表里没有的原样返回 id） */
export type PeopleLookup = { nameOf: (personId: string) => string }

export function peopleLookupOf(people: readonly Person[]): PeopleLookup {
  const personById = new Map(people.map((person) => [person.id, person] as const))
  return { nameOf: (personId) => personById.get(personId)?.name ?? personId }
}

/** 本机身份：本 home 的身份码在人员列表里对应的人；不在列表里为 null */
export function personOfCode(people: readonly Person[], code: string): Person | null {
  return people.find((person) => person.codes?.includes(code)) ?? null
}
