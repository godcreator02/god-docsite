import type { Person } from './people.js'

/** 评论正文里 @ 了谁：写成 @<id>，id 要在人员列表里；按出现顺序、不重复 */
export function mentionsOf(body: string, people: readonly Person[]): string[] {
  const knownIds = new Set(people.map((person) => person.id))
  const mentionedIds: string[] = []
  for (const [, id] of body.matchAll(/(?<![\w@])@([\w-]+)/g)) if (knownIds.has(id!) && !mentionedIds.includes(id!)) mentionedIds.push(id!)
  return mentionedIds
}

/** 光标前正在打的 @：start 是 @ 的位置，query 是 @ 后面已经打的字；不在打 @ 时是 null。认法和 mentionsOf 一样 */
export function mentionBeingTyped(textBeforeCursor: string): { start: number; query: string } | null {
  const match = /(?<![\w@])@([\w-]*)$/.exec(textBeforeCursor)
  return match ? { start: match.index, query: match[1]! } : null
}

/** 写 @ 时弹出的名单：id 或名字里含 query 的人（不分大小写），id 以 query 开头的排前面 */
export function peopleMatching<T extends Person>(people: readonly T[], query: string): T[] {
  const lowered = query.toLowerCase()
  const matching = people.filter((person) => person.id.toLowerCase().includes(lowered) || person.name.toLowerCase().includes(lowered))
  const idStartsWithQuery = (person: Person) => person.id.toLowerCase().startsWith(lowered)
  return [...matching.filter(idStartsWithQuery), ...matching.filter((person) => !idStartsWithQuery(person))]
}
