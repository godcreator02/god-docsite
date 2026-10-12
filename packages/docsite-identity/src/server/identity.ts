import { peopleFile, publicPersonOf, type SiteIdentity } from '../model.js'
import type { StoredPerson } from './people-file.js'
import { sitePeople } from './site-people.js'

/** 开发服务从这个环境变量取本机的身份码 */
export const identityCodeEnvName = 'DOCSITE_IDENTITY_CODE'

/**
 * 本机的身份：人员列表里有这个码就是那个人；没有码、码不在列表里时站点只读，reason 写明怎么补。
 * 返回的 person 是投影过的公开形状，reason 里也不写码本身
 */
export function identityOf(people: readonly StoredPerson[], code: string | undefined): SiteIdentity {
  if (!code) return { person: null, reason: '只读：这个开发服务不是经 gwb 插件 gwb-docsite 启动的，没有本机的身份码' }
  const person = people.find((candidate) => candidate.codes?.includes(code))
  if (!person) return { person: null, reason: `只读：本机的身份码不在 ${peopleFile} 里，调 docsite.people.join 把自己加进去` }
  return { person: publicPersonOf(person) }
}

/**
 * 这个站的本机身份：按环境变量 DOCSITE_IDENTITY_CODE 的身份码在人员列表里找人（gwb-docsite 启动开发服务时放进去）。
 * 只看环境变量里有没有码；发布出去的站由宿主保证不设这个环境变量，包里不看 DEV 编译标记
 */
export function siteIdentity(siteDir = process.cwd()): SiteIdentity {
  return identityOf(sitePeople(siteDir), process.env[identityCodeEnvName])
}
