/**
 * 站点人员：每个站在站点目录里放 people.json 列出参与的人（进 git），再放一个 me.json 写「我是谁」（不进 git，每人本机一份）。
 * 评论的 author、resolvedBy 存人员的 id，页面上显示 name
 */

/** 人员列表里的一个人。agent 为 true 的是 agent：它调评论接口时用 as 说明自己是谁；人的身份只取 me.json */
export type Person = { id: string; name: string; agent?: boolean }

/** 人员列表，站点目录里的 people.json */
export const peopleFile = 'people.json'
/** 「我是谁」，站点目录里的 me.json，写 { "id": "…" }，不进 git */
export const meFile = 'me.json'

const personIdPattern = /^[\w-]+$/
const personKeys = ['id', 'name', 'agent']

/** 校验 people.json 的内容：一个数组，每项 { id, name, agent? }，id 只用字母、数字、_、-，不重复。写错时一次列出全部 */
export function parsePeople(value: unknown): Person[] {
  if (!Array.isArray(value)) throw new Error(`${peopleFile} 要是一个数组，每项写 { "id": "zhou", "name": "小周" }`)
  const problems: string[] = []
  const seen = new Set<string>()
  value.forEach((item, index) => {
    const where = `${peopleFile} 第 ${index + 1} 项`
    if (typeof item !== 'object' || item === null || Array.isArray(item)) return problems.push(`${where} 要是 { "id": …, "name": … }`)
    const { id, name, agent } = item as Record<string, unknown>
    for (const key of Object.keys(item)) if (!personKeys.includes(key)) problems.push(`${where}：认不出 ${key}，能写的只有 ${personKeys.join('、')}`)
    if (typeof id !== 'string' || !personIdPattern.test(id)) problems.push(`${where}：id 要是字母、数字、_、- 组成的字符串`)
    else if (seen.has(id)) problems.push(`${where}：id ${id} 和前面的重复了`)
    else seen.add(id)
    if (typeof name !== 'string' || name.trim() === '') problems.push(`${where}：name 要是非空字符串`)
    if (agent !== undefined && typeof agent !== 'boolean') problems.push(`${where}：agent 要是 true 或 false`)
  })
  if (problems.length > 0) throw new Error(problems.join('\n'))
  return value as Person[]
}

/** 校验 me.json 的内容 { "id": "…" }，返回那个人；id 不在人员列表里、是 agent 时报错 */
export function parseMe(value: unknown, people: readonly Person[]): Person {
  const keys = typeof value === 'object' && value !== null && !Array.isArray(value) ? Object.keys(value) : []
  const id = keys.length === 1 ? (value as Record<string, unknown>).id : undefined
  if (typeof id !== 'string') throw new Error(`${meFile} 要写成 { "id": "<${peopleFile} 里你的 id>" }`)
  const person = people.find((candidate) => candidate.id === id)
  if (!person) throw new Error(`${meFile} 写的 ${id} 不在 ${peopleFile} 里：先在 ${peopleFile} 里加上这个人`)
  if (person.agent) throw new Error(`${meFile} 写的 ${id} 是 agent：me.json 写人的 id，agent 调评论接口时用 as 说明自己是谁`)
  return person
}

/** 按 id 取人；评论文件里的作者已经核对过都在人员列表里，取不到是调用方传错了 */
export function personOf(people: readonly Person[], id: string): Person {
  const person = people.find((candidate) => candidate.id === id)
  if (!person) throw new Error(`${peopleFile} 里没有 ${id}`)
  return person
}
