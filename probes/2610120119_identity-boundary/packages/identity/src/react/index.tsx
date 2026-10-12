import type { ReactNode } from 'react'
import type { Person, SiteIdentity } from '../model.js'

function hueOfId(id: string) {
  let hash = 0
  for (const char of id) hash = (hash * 31 + char.codePointAt(0)!) % 360
  return hash
}

/** 头像：名字的第一个字加一个由 id 算出的底色（改名不变色），不联网取图。样式在包的 styles.css（.ib-avatar），宿主引入后就有 */
export function Avatar({ person, size = 24 }: { person: Person; size?: number }) {
  return (
    <span
      aria-hidden="true"
      className="ib-avatar"
      style={{ width: size, height: size, fontSize: size * 0.45, backgroundColor: `hsl(${hueOfId(person.id)} 45% 45%)` }}
    >
      {[...person.name][0]!.toUpperCase()}
    </span>
  )
}

/**
 * 当前身份标识：有身份显示头像与名字，只读时显示「只读」，鼠标停上去看原因（title）。
 * children 是宿主接的展示插槽（主题切换、人员管理入口这类宿主自己的东西放这里），身份包不注入功能。
 * 样式在包的 styles.css（.ib-identity），宿主引入后就有
 */
export function IdentityBadge({ identity, children }: { identity: SiteIdentity; children?: ReactNode }) {
  const { person } = identity
  if (!person) {
    return (
      <span className="ib-identity ib-identity-readonly">
        <span className="ib-identity-name" title={identity.reason}>
          只读
        </span>
        {children}
      </span>
    )
  }
  return (
    <span className="ib-identity" title={`评论署名：${person.name}（人员列表里的 ${person.id}，按本机的身份码认出）`}>
      <Avatar person={person} size={22} />
      <span className="ib-identity-name">{person.name}</span>
      {children}
    </span>
  )
}
