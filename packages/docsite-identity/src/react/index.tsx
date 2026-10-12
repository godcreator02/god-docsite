import type { Person, SiteIdentity } from '../model.js'

function hueOfId(id: string) {
  let hash = 0
  for (const char of id) hash = (hash * 31 + char.codePointAt(0)!) % 360
  return hash
}

/** 头像：名字的第一个字加一个由 id 算出的底色（改名不变色），不联网取图。样式在包的 styles.css（.dc-avatar），宿主引入后就有 */
export function Avatar({ person, size = 24 }: { person: Person; size?: number }) {
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
