import { createContext, use, type ReactNode } from 'react'
import type { SiteIdentity } from '../core/identity.js'
import type { PublicPerson } from '../core/public-people.js'

type SiteIdentityContextValue = { identity: SiteIdentity; people: readonly PublicPerson[] }

const SiteIdentityContext = createContext<SiteIdentityContextValue | null>(null)

/**
 * 把本机身份与人员列表交给页面里的组件。people 只收 PublicPerson：站点的 loader 先用 publicPeopleOf 投影再放进 loader 数据。
 * 不变式：交给浏览器的人员不带身份码；类型挡不住 as 断言，渲染时再查一次，带着就报错
 */
export function IdentityProvider({ identity, people, children }: { identity: SiteIdentity; people: readonly PublicPerson[]; children: ReactNode }) {
  const personWithCodes = people.find((person) => 'codes' in person)
  if (personWithCodes) throw new Error(`交给浏览器的人员列表带着身份码（${personWithCodes.id}）：先经 publicPeopleOf 投影`)
  return <SiteIdentityContext value={{ identity, people }}>{children}</SiteIdentityContext>
}

function useSiteIdentityContext(hookName: string): SiteIdentityContextValue {
  const value = use(SiteIdentityContext)
  if (value === null) throw new Error(`${hookName} 要在 IdentityProvider 里面用`)
  return value
}

/** 本机身份：有人时是公开形状的那个人，只读时带原因 */
export function useSiteIdentity(): SiteIdentity {
  return useSiteIdentityContext('useSiteIdentity').identity
}

/** 站点的人员列表（公开形状）：写 @ 时弹名单、按 id 显示名字用 */
export function useSitePeople(): readonly PublicPerson[] {
  return useSiteIdentityContext('useSitePeople').people
}

function hueOfId(id: string) {
  let hash = 0
  for (const char of id) hash = (hash * 31 + char.codePointAt(0)!) % 360
  return hash
}

/** 头像：名字的第一个字加一个由 id 算出的底色（改名不变色），不联网取图。样式在包的 styles.css（.dc-avatar），宿主引入后就有 */
export function Avatar({ person, size = 24 }: { person: PublicPerson; size?: number }) {
  return (
    <span
      aria-hidden="true"
      className="dc-avatar"
      style={{ width: size, height: size, fontSize: size * 0.45, backgroundColor: `hsl(${hueOfId(person.id)} 45% 45%)` }}
    >
      {[...person.name][0]!.toUpperCase()}
    </span>
  )
}

/**
 * 侧栏底部显示的当前身份：有身份显示头像与名字，只读时写「只读」，鼠标停上去看原因。
 * 主题切换属于宿主站点，由它放在这个组件旁边。样式在包的 styles.css（.dc-identity），宿主引入后就有
 */
export function IdentityBadge({ identity }: { identity: SiteIdentity }) {
  const { person } = identity
  if (!person) {
    return (
      <span className="dc-identity dc-identity-readonly" title={identity.reason}>
        只读
      </span>
    )
  }
  return (
    <span className="dc-identity" title={`评论署名：${person.name}（人员列表里的 ${person.id}，按本机的身份码认出）`}>
      <Avatar person={person} size={22} />
      <span className="dc-identity-name">{person.name}</span>
    </span>
  )
}
