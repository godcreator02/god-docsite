import type { SiteIdentity } from '@godcreator/identity'
import type { CommentsAccess } from './comments-sidebar.js'

/** 评论面板的写入口状态：有本机身份就可写、署名是这个人，没有就只读并写明原因 */
export function commentsAccessOf(identity: SiteIdentity): CommentsAccess {
  if (identity.person) return { kind: 'writable', writer: { id: identity.person.id, name: identity.person.name } }
  return { kind: 'readonly', reasonCode: 'readonly', reasonText: identity.reason }
}
