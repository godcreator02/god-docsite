/**
 * 站点人员：每个站在站点目录里放 people.json 列出参与的人（进 git）。
 * 「我是谁」不写在站点里：gwb 插件 gwb-docsite 启动开发服务时把本机的身份码放进环境变量，站点按码在人员列表里找到人。
 * 评论的 author、resolvedBy 存人员的 id，页面上显示 name
 */

/**
 * 人员列表里的一个人。
 * codes 是这个人用过的身份码（每个 gwb home 一个），gitea 是 Gitea 账号（协作站核对权限用），
 * agent 为 true 的是 agent：没有码，调评论接口时用 as 说明自己是谁
 */
export type Person = { id: string; name: string; codes?: string[]; gitea?: string; agent?: boolean }

/** 人员列表，站点目录里的 people.json */
export const peopleFile = 'people.json'

/** 开发服务从这个环境变量取本机的身份码 */
export const identityCodeEnvName = 'DOCSITE_IDENTITY_CODE'

const personIdPattern = /^[\w-]+$/
/** 身份码：小写字母与数字 */
export const identityCodePattern = /^[a-z0-9]{8,64}$/
const personKeys = ['id', 'name', 'codes', 'gitea', 'agent']

/** 校验 people.json 的内容：一个数组，每项 { id, name, codes?, gitea?, agent? }；id、码都不重复。写错时一次列出全部 */
export function parsePeople(value: unknown): Person[] {
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
  return value as Person[]
}

/** 本机的身份：人员列表里有这个码就是那个人；没有码、码不在列表里时站点只读，reason 写明怎么补 */
export type SiteIdentity = { person: Person; reason?: undefined } | { person: null; reason: string }

export function identityOf(people: readonly Person[], code: string | undefined): SiteIdentity {
  if (!code) return { person: null, reason: '只读：这个开发服务不是经 gwb 插件 gwb-docsite 启动的，没有本机的身份码' }
  const person = people.find((candidate) => candidate.codes?.includes(code))
  if (!person) return { person: null, reason: `只读：本机的身份码 ${code} 不在 ${peopleFile} 里，调 docsite.people.join 把自己加进去` }
  return { person }
}

/** 按 id 取人；评论文件里的作者已经核对过都在人员列表里，取不到是调用方传错了 */
export function personOf(people: readonly Person[], id: string): Person {
  const person = people.find((candidate) => candidate.id === id)
  if (!person) throw new Error(`${peopleFile} 里没有 ${id}`)
  return person
}

/**
 * 把本机的码加进人员列表：已有这个 id 就把码加进它的 codes（gitea 给了就核对或补上），没有就新加一项。
 * 码已经在别人名下、id 是 agent、gitea 和已写的不一样时报错
 */
export function peopleWithJoined(people: readonly Person[], code: string, joining: { id: string; name: string; gitea?: string }): Person[] {
  const owner = people.find((candidate) => candidate.codes?.includes(code))
  if (owner && owner.id !== joining.id) throw new Error(`身份码 ${code} 已经写在 ${owner.id} 名下，一个码只能是一个人的`)
  const existing = people.find((candidate) => candidate.id === joining.id)
  if (!existing) return parsePeople([...people, { id: joining.id, name: joining.name, codes: [code], ...(joining.gitea ? { gitea: joining.gitea } : {}) }])
  if (existing.agent) throw new Error(`${joining.id} 是 agent，agent 没有身份码`)
  if (joining.gitea && existing.gitea && existing.gitea !== joining.gitea) throw new Error(`${joining.id} 的 gitea 写的是 ${existing.gitea}，不是 ${joining.gitea}`)
  const joined: Person = { ...existing, codes: existing.codes?.includes(code) ? existing.codes : [...(existing.codes ?? []), code] }
  if (joining.gitea && !existing.gitea) joined.gitea = joining.gitea
  return parsePeople(people.map((candidate) => (candidate.id === joining.id ? joined : candidate)))
}

/** 评论正文里 @ 了谁：写成 @<id>，id 要在人员列表里；按出现顺序、不重复 */
/** 光标前正在打的 @：start 是 @ 的位置，query 是 @ 后面已经打的字；不在打 @ 时是 null。认法和 mentionsOf 一样 */
export function mentionBeingTyped(textBeforeCursor: string): { start: number; query: string } | null {
  const match = /(?<![\w@])@([\w-]*)$/.exec(textBeforeCursor)
  return match ? { start: match.index, query: match[1]! } : null
}

/** 写 @ 时弹出的名单：id 或名字里含 query 的人（不分大小写），id 以 query 开头的排前面 */
export function peopleMatching(people: readonly Person[], query: string): Person[] {
  const lowered = query.toLowerCase()
  const matching = people.filter((person) => person.id.toLowerCase().includes(lowered) || person.name.toLowerCase().includes(lowered))
  const startsWithQuery = (person: Person) => person.id.toLowerCase().startsWith(lowered)
  return [...matching.filter(startsWithQuery), ...matching.filter((person) => !startsWithQuery(person))]
}

export function mentionsOf(body: string, people: readonly Person[]): string[] {
  const known = new Set(people.map((person) => person.id))
  const mentioned: string[] = []
  for (const [, id] of body.matchAll(/(?<![\w@])@([\w-]+)/g)) if (known.has(id!) && !mentioned.includes(id!)) mentioned.push(id!)
  return mentioned
}
