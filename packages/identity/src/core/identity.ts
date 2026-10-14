import { peopleFile, type Person, type StoredPerson } from './people.js'
import { publicPersonOf, type PublicPerson } from './public-people.js'

/**
 * 本机的身份：人员列表里有这个码就是那个人；没有码、码不在列表里时站点只读，reason 写明怎么补。
 * 默认的 person 是公开形状，可以交给浏览器；服务端函数（如 authorizeWrite）收更宽的 SiteIdentity<Person>
 */
export type SiteIdentity<P extends Person = PublicPerson> = { person: P; reason?: undefined } | { person: null; reason: string }

/** 按身份码在人员列表里找人。返回的 person 是投影过的公开形状，reason 里也不写码本身 */
export function identityOf(people: readonly StoredPerson[], code: string | undefined): SiteIdentity {
  if (!code) return { person: null, reason: '只读：这个开发服务不是经 gwb 插件 gwb-docsite 启动的，没有本机的身份码' }
  const person = people.find((candidate) => candidate.codes?.includes(code))
  if (!person) return { person: null, reason: `只读：本机的身份码不在 ${peopleFile} 里，调 docsite.people.join 把自己加进去` }
  return { person: publicPersonOf(person) }
}
