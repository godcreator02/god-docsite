import { peopleFile, publicPersonOf, type SiteIdentity } from '../model.js'
import type { StoredPerson } from './people-file.js'

/** 码的约定环境变量名：gwb 插件启动开发服务时把本机的身份码放这里。包只导出名字，读不读它由宿主决定 */
export const identityCodeEnvName = 'DOCSITE_IDENTITY_CODE'

/**
 * 按宿主提供的身份码解析本机身份：people 与 code 都由宿主传入（码从环境变量、gwb 注入还是别处来，包不管）。
 * 人员列表里有这个码就是那个人；没有码、码不在列表里时站点只读，reason 写明怎么补，不出现码本身。
 * 返回的 person 经 publicPersonOf 投影
 */
export function resolveIdentity(people: readonly StoredPerson[], code: string | undefined): SiteIdentity {
  if (!code) return { person: null, reason: `只读：这个服务没有本机的身份码，经 gwb 插件 gwb-docsite 启动时它会放进环境变量 ${identityCodeEnvName}` }
  const person = people.find((candidate) => candidate.codes?.includes(code))
  if (!person) return { person: null, reason: `只读：本机的身份码不在 ${peopleFile} 里，调 docsite.people.join 把自己加进去` }
  return { person: publicPersonOf(person) }
}
