/**
 * 站点人员：每个站在站点目录里放 people.json 列出参与的人（进 git）。
 * 「我是谁」不写在站点里：gwb 插件 gwb-docsite 启动开发服务时把本机的身份码放进环境变量，
 * 服务端按码在人员列表里找到人（见 server 入口）。身份码只能留在服务端：这个入口的类型与函数不含 codes，
 * 给浏览器的人员列表先用 publicPeopleOf 投影一遍。
 * 评论的 author、resolvedBy 存人员的 id，页面上显示 name
 */

/**
 * 人员列表里的一个人（公开形状）。
 * gitea 是 Gitea 账号（协作站核对权限用），agent 为 true 的是 agent：没有身份码，调评论接口时用 as 说明自己是谁。
 * 服务端内存放与校验的完整形状（带身份码 codes）见 server 入口的 StoredPerson
 */
export type Person = { id: string; name: string; gitea?: string; agent?: boolean }

/** 本机的身份：人员列表里有这个码就是那个人；没有码、码不在列表里时站点只读，reason 写明怎么补 */
export type SiteIdentity = { person: Person; reason?: undefined } | { person: null; reason: string }

/** 人员列表，站点目录里的 people.json */
export const peopleFile = 'people.json'

/** 按 id 取人；评论文件里的作者已经核对过都在人员列表里，取不到是调用方传错了 */
export function personOf<T extends Person>(people: readonly T[], id: string): T {
  const person = people.find((candidate) => candidate.id === id)
  if (!person) throw new Error(`${peopleFile} 里没有 ${id}`)
  return person
}

/** 给浏览器的那个人：按白名单重造一个对象，身份码 codes 留在服务端，不会带出去 */
export function publicPersonOf(person: Person): Person {
  const publicPerson: Person = { id: person.id, name: person.name }
  if (person.gitea !== undefined) publicPerson.gitea = person.gitea
  if (person.agent !== undefined) publicPerson.agent = person.agent
  return publicPerson
}

export function publicPeopleOf(people: readonly Person[]): Person[] {
  return people.map(publicPersonOf)
}

/** 评论正文里 @ 了谁：写成 @<id>，id 要在人员列表里；按出现顺序、不重复 */
export function mentionsOf(body: string, people: readonly Person[]): string[] {
  const known = new Set(people.map((person) => person.id))
  const mentioned: string[] = []
  for (const [, id] of body.matchAll(/(?<![\w@])@([\w-]+)/g)) if (known.has(id!) && !mentioned.includes(id!)) mentioned.push(id!)
  return mentioned
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
  const startsWithQuery = (person: Person) => person.id.toLowerCase().startsWith(lowered)
  return [...matching.filter(startsWithQuery), ...matching.filter((person) => !startsWithQuery(person))]
}
