import { peopleFile, publicPersonOf, type Person, type SiteIdentity } from '../model.js'

/** 写入请求被拒：status 是要回给浏览器的 HTTP 状态码，message 可直接放进响应体（不含身份码） */
export class WriteAccessError extends Error {
  readonly status: number

  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

/**
 * 核对一次写入请求，返回这次以谁的身份写。
 * origin 是宿主可信配置里这个站的完整 origin，请求的 Origin 头要和它完全一样，缺了或不一样 403；
 * 没有本机身份时 403；as 省略（undefined 或 null）用当前身份，as 只允许人员列表里已登记的 agent：
 * 没有这个人 400，是人的 403（人不能经接口换成别人）。身份与 origin 都不由请求传入。
 * 两条成功路径返回的人都经 publicPersonOf 白名单投影：Person 是结构化类型，调用方传入的对象带着
 * codes 或别的服务端字段时，不能跟着返回出去
 */
export function authorizeWrite(request: Request, options: { identity: SiteIdentity; people: readonly Person[]; as?: unknown; origin: string }): Person {
  if (request.headers.get('origin') !== options.origin) throw new WriteAccessError(403, `写入只接受来自 ${options.origin} 的请求`)
  const { identity } = options
  if (!identity.person) throw new WriteAccessError(403, identity.reason)
  const as = options.as
  if (as === undefined || as === null) return publicPersonOf(identity.person)
  if (typeof as !== 'string') throw new WriteAccessError(400, `as 要是字符串：收到 ${Object.prototype.toString.call(as)}`)
  if (as === '') throw new WriteAccessError(400, 'as 不能是空字符串：不代人就用当前身份，省掉 as')
  const person = options.people.find((candidate) => candidate.id === as)
  if (!person) throw new WriteAccessError(400, `${peopleFile} 里没有 ${as}`)
  if (!person.agent) throw new WriteAccessError(403, `as 只给 agent 用：${as} 不是 agent，人的身份取本机的身份码`)
  return publicPersonOf(person)
}

/** 把 authorizeWrite 抛的错转成要回给浏览器的 Response；不是 WriteAccessError 的错原样再抛（不吞服务端错误） */
export function writeAccessResponse(error: unknown): Response {
  if (!(error instanceof WriteAccessError)) throw error
  return new Response(`${error.message}\n`, { status: error.status, headers: { 'content-type': 'text/plain; charset=utf-8' } })
}
