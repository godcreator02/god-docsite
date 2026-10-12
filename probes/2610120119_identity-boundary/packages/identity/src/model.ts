/**
 * 人员列表里一个人的公开形状：出服务端、进浏览器的只有这些字段。
 * 身份码（codes）只存在于服务端的存放形状（server 入口的 StoredPerson），
 * 给浏览器的人要先经 publicPersonOf 投影。
 */
export type Person = { id: string; name: string; gitea?: string; agent?: boolean }

/** 一次身份解析的结果：认出人时 person 非空；认不出时站点只读，reason 写明怎么补，不含身份码 */
export type SiteIdentity = { person: Person; reason?: undefined } | { person: null; reason: string }

/** 人员列表文件名：站点目录里的 people.json，存放格式见 server 入口 */
export const peopleFile = 'people.json'

/** 按 id 取人；评论文件里存的作者 id 都核对过在人员列表里，取不到是调用方传错了 */
export function personOf<T extends Person>(people: readonly T[], id: string): T {
  const person = people.find((candidate) => candidate.id === id)
  if (!person) throw new Error(`${peopleFile} 里没有 ${id}`)
  return person
}

/**
 * 给浏览器的那个人：按白名单重造一个新对象，不是拷贝输入。
 * Person 是结构化类型：调用方手里的对象运行时可能带着 codes 或别的服务端字段，
 * 直接返回会把它们带出去，所以成功路径都必须过这一层
 */
export function publicPersonOf(person: Person): Person {
  const publicPerson: Person = { id: person.id, name: person.name }
  if (person.gitea !== undefined) publicPerson.gitea = person.gitea
  if (person.agent !== undefined) publicPerson.agent = person.agent
  return publicPerson
}

export function publicPeopleOf(people: readonly Person[]): Person[] {
  return people.map(publicPersonOf)
}
