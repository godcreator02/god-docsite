import { describe, expect, it } from 'vitest'
import { authorizeWrite, identityOf, writeAccessResponse, WriteAccessError, type Person, type StoredPerson } from '../src/server/index.js'

const people: StoredPerson[] = [
  { id: 'zhou', name: '小周', codes: ['zhoucode0001'] },
  { id: 'li', name: '小李' },
  { id: 'claude', name: 'Claude', agent: true },
]

const origin = 'http://127.0.0.1:4430'
const zhou = identityOf(people, 'zhoucode0001')

/** origin 给了才像从浏览器发来的请求 */
function postFrom(headerOrigin: string | null) {
  const headers = new Headers()
  if (headerOrigin !== null) headers.set('Origin', headerOrigin)
  return new Request('http://site/api/comments', { method: 'POST', headers, body: new FormData() })
}

describe('写入前的核对', () => {
  it('请求的 Origin 和宿主配置的完全一样才放行；缺了、不一样都是 403', () => {
    expect(authorizeWrite(postFrom(origin), { identity: zhou, people, origin }).id).toBe('zhou')
    expect(authorizeWrite(postFrom('http://127.0.0.1:4430'), { identity: zhou, people, origin }).id).toBe('zhou')
    expect(() => authorizeWrite(postFrom(null), { identity: zhou, people, origin })).toThrow(WriteAccessError)
    expect(() => authorizeWrite(postFrom(origin), { identity: zhou, people, origin: 'http://127.0.0.1:5460' })).toThrow(WriteAccessError)
    expect(() => authorizeWrite(postFrom('http://evil.example'), { identity: zhou, people, origin })).toThrow(WriteAccessError)
    expect(() => authorizeWrite(postFrom('http://127.0.0.1:4430.evil.example'), { identity: zhou, people, origin })).toThrow(WriteAccessError)
    expect(() => authorizeWrite(postFrom(origin), { identity: zhou, people, origin })).not.toThrow()
  })

  it('拒绝时抛 WriteAccessError，status 是要回给浏览器的状态码', () => {
    const rejected = () => authorizeWrite(postFrom(origin), { identity: zhou, people, as: 'nobody', origin })
    expect(rejected).toThrow(WriteAccessError)
    try {
      rejected()
    } catch (error) {
      expect((error as WriteAccessError).status).toBe(400)
    }
  })

  it('没有本机身份时 403，原因用只读原因；请求体和身份不由请求传入', () => {
    const readOnly = identityOf(people, undefined)
    try {
      authorizeWrite(postFrom(origin), { identity: readOnly, people, origin })
      expect.unreachable()
    } catch (error) {
      expect((error as WriteAccessError).status).toBe(403)
      expect((error as WriteAccessError).message).toContain('只读')
    }
  })

  it('as 省略或 null：用当前身份；返回的 person 不带 codes', () => {
    const withoutAs = authorizeWrite(postFrom(origin), { identity: zhou, people, origin })
    expect(withoutAs.id).toBe('zhou')
    expect('codes' in withoutAs).toBe(false)
    expect(authorizeWrite(postFrom(origin), { identity: zhou, people, as: null, origin }).id).toBe('zhou')
  })

  it('as 是已登记的 agent：以那个 agent 的身份写', () => {
    expect(authorizeWrite(postFrom(origin), { identity: zhou, people, as: 'claude', origin }).id).toBe('claude')
  })

  it('as 写了人员列表里没有的人 400；写了人（不是 agent）403，人不能经接口换成别人', () => {
    try {
      authorizeWrite(postFrom(origin), { identity: zhou, people, as: 'nobody', origin })
      expect.unreachable()
    } catch (error) {
      expect((error as WriteAccessError).status).toBe(400)
    }
    try {
      authorizeWrite(postFrom(origin), { identity: zhou, people, as: 'li', origin })
      expect.unreachable()
    } catch (error) {
      expect((error as WriteAccessError).status).toBe(403)
      expect((error as WriteAccessError).message).toContain('as 只给 agent 用')
    }
  })
})

describe('返回的人经白名单投影', () => {
  /** Person 是结构化类型：调用方传 Person 类型的值，运行时可能带着 codes 或别的服务端字段 */
  const zhouWithServerFields: StoredPerson & { extra: string } = { id: 'zhou', name: '小周', gitea: 'zhou', codes: ['zhoucode0001'], extra: 'server-only' }
  const agentWithExtra: Person & { extra: string } = { id: 'claude', name: 'Claude', agent: true, extra: 'server-only' }

  it('as 省略或 null：identity.person 带着 codes 与 extra 时，返回只有 id、name、gitea，输入对象原样', () => {
    for (const as of [undefined, null]) {
      const returned = authorizeWrite(postFrom(origin), { identity: { person: zhouWithServerFields }, people: [zhouWithServerFields, agentWithExtra], as, origin })
      expect(returned).toEqual({ id: 'zhou', name: '小周', gitea: 'zhou' })
      expect('codes' in returned).toBe(false)
      expect('extra' in returned).toBe(false)
    }
    expect(zhouWithServerFields).toEqual({ id: 'zhou', name: '小周', gitea: 'zhou', codes: ['zhoucode0001'], extra: 'server-only' })
  })

  it('as 是合法 agent：people 里的 agent 带着 extra 时，返回只有 id、name、agent，输入对象原样', () => {
    const returned = authorizeWrite(postFrom(origin), { identity: { person: zhouWithServerFields }, people: [zhouWithServerFields, agentWithExtra], as: 'claude', origin })
    expect(returned).toEqual({ id: 'claude', name: 'Claude', agent: true })
    expect('extra' in returned).toBe(false)
    expect(agentWithExtra).toEqual({ id: 'claude', name: 'Claude', agent: true, extra: 'server-only' })
  })
})

describe('as 的形状与错误转响应', () => {
  it('as 是空字符串或非字符串（如表单里传了文件）都 400，不落到查人', () => {
    for (const as of ['', 42, {}]) {
      try {
        authorizeWrite(postFrom(origin), { identity: zhou, people, as, origin })
        expect.unreachable()
      } catch (error) {
        expect((error as WriteAccessError).status).toBe(400)
      }
    }
  })

  it('writeAccessResponse 把 WriteAccessError 转成对应状态码的文本响应；别的错原样再抛', () => {
    const response = writeAccessResponse(new WriteAccessError(403, '写入只接受来自 http://127.0.0.1:4430 的请求'))
    expect(response.status).toBe(403)
    expect(response.headers.get('content-type')).toContain('text/plain')
    const boom = new Error('服务端错误')
    expect(() => writeAccessResponse(boom)).toThrow(boom)
  })
})
