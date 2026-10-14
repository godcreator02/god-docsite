/** 人员列表：站点目录里的 people.json（进 git），列出参与这个站的人与 agent */
export const peopleFile = 'people.json'

/**
 * 一个人的公共字段：存放形状 StoredPerson 与公开形状 PublicPerson 都满足它，只读这几项的函数收它。
 * gitea 是 Gitea 账号（协作站核对权限用）；agent 为 true 的是 agent：没有身份码，写入时用 as 说明自己是谁
 */
export type Person = { id: string; name: string; gitea?: string; agent?: boolean }

/**
 * people.json 里一个人的存放形状：公共字段加上这个人用过的身份码（每个 gwb home 一个）。
 * 只在服务端用；交给浏览器的一律先经 publicPersonOf 投影成 PublicPerson
 */
export type StoredPerson = Person & { codes?: string[] }

const personIdPattern = /^[\w-]+$/
/** 身份码：小写字母与数字 */
export const identityCodePattern = /^[a-z0-9]{8,64}$/
const personKeys = ['id', 'name', 'codes', 'gitea', 'agent']

/** 校验 people.json 的内容：一个数组，每项 { id, name, codes?, gitea?, agent? }；id、码都不重复。写错时一次列出全部 */
export function parsePeople(value: unknown): StoredPerson[] {
  if (!Array.isArray(value)) throw new Error(`${peopleFile} 要是一个数组，每项写 { "id": "zhou", "name": "小周", "codes": ["<身份码>"] }`)
  const problems: string[] = []
  const seenIds = new Set<string>()
  const ownerOfCode = new Map<string, string>()
  value.forEach((item: unknown, index) => {
    const where = `${peopleFile} 第 ${index + 1} 项`
    if (typeof item !== 'object' || item === null || Array.isArray(item)) return problems.push(`${where} 要是 { "id": …, "name": … }`)
    const record = item as Record<string, unknown>
    const { id, name, codes, gitea, agent } = record
    for (const key of Object.keys(record)) if (!personKeys.includes(key)) problems.push(`${where}：认不出 ${key}，能写的只有 ${personKeys.join('、')}`)
    if (typeof id !== 'string' || !personIdPattern.test(id)) problems.push(`${where}：id 要是字母、数字、_、- 组成的字符串`)
    else if (seenIds.has(id)) problems.push(`${where}：id ${id} 和前面的重复了`)
    else seenIds.add(id)
    if (typeof name !== 'string' || name.trim() === '') problems.push(`${where}：name 要是非空字符串`)
    if (agent !== undefined && typeof agent !== 'boolean') problems.push(`${where}：agent 要是 true 或 false`)
    if (gitea !== undefined && (typeof gitea !== 'string' || gitea === '')) problems.push(`${where}：gitea 要是非空字符串`)
    if (codes === undefined) return
    if (agent === true) return problems.push(`${where}：agent 没有身份码，去掉 codes`)
    if (!Array.isArray(codes) || codes.length === 0) return problems.push(`${where}：codes 要是身份码的数组，至少一个`)
    for (const code of codes as unknown[]) {
      if (typeof code !== 'string' || !identityCodePattern.test(code)) problems.push(`${where}：身份码 ${String(code)} 要是 8 到 64 个小写字母或数字`)
      else if (ownerOfCode.has(code)) problems.push(`${where}：身份码 ${code} 已经写在 ${ownerOfCode.get(code)} 名下，一个码只能是一个人的`)
      else ownerOfCode.set(code, typeof id === 'string' ? id : `第 ${index + 1} 项`)
    }
  })
  if (problems.length > 0) throw new Error(problems.join('\n'))
  return value as StoredPerson[]
}

/** 按 id 取人；评论文件里的作者已经核对过都在人员列表里，取不到是调用方传错了 */
export function personOf<T extends Person>(people: readonly T[], id: string): T {
  const person = people.find((candidate) => candidate.id === id)
  if (!person) throw new Error(`${peopleFile} 里没有 ${id}`)
  return person
}

/** 要加进人员列表的人：本机的身份码配上的那个 id、名字与可选的 Gitea 账号 */
export type JoiningPerson = { id: string; name: string; gitea?: string }

/**
 * 把本机的码加进人员列表：已有这个 id 就把码加进它的 codes（gitea 给了就核对或补上），没有就新加一项。
 * 码已经在别人名下、id 是 agent、gitea 和已写的不一样时报错
 */
export function peopleWithJoined(people: readonly StoredPerson[], code: string, joining: JoiningPerson): StoredPerson[] {
  const owner = people.find((candidate) => candidate.codes?.includes(code))
  if (owner && owner.id !== joining.id) throw new Error(`身份码 ${code} 已经写在 ${owner.id} 名下，一个码只能是一个人的`)
  const existing = people.find((candidate) => candidate.id === joining.id)
  if (!existing) return parsePeople([...people, { id: joining.id, name: joining.name, codes: [code], ...(joining.gitea ? { gitea: joining.gitea } : {}) }])
  if (existing.agent) throw new Error(`${joining.id} 是 agent，agent 没有身份码`)
  if (joining.gitea && existing.gitea && existing.gitea !== joining.gitea) throw new Error(`${joining.id} 的 gitea 写的是 ${existing.gitea}，不是 ${joining.gitea}`)
  const joined: StoredPerson = { ...existing, codes: existing.codes?.includes(code) ? existing.codes : [...(existing.codes ?? []), code] }
  if (joining.gitea && !existing.gitea) joined.gitea = joining.gitea
  return parsePeople(people.map((candidate) => (candidate.id === joining.id ? joined : candidate)))
}
