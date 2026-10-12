import { afterEach, describe, expect, it, vi } from 'vitest'
import { authorizeWrite, WriteAccessError } from '../src/server/write-access.js'
import { resolveIdentity } from '../src/server/identity.js'
import type { StoredPerson } from '../src/server/people-file.js'
import type { Person } from '../src/index.js'

const people: StoredPerson[] = [
  { id: 'zhou', name: '小周', codes: ['probezhou001'] },
  { id: 'li', name: '小李' },
  { id: 'claude', name: 'Claude', agent: true },
  { id: 'zcode', name: 'ZCode', agent: true },
]

const origin = 'http://127.0.0.1:5490'
const zhou = resolveIdentity(people, 'probezhou001')

/** 模拟浏览器表单 POST；headerOrigin 为 null 表示不带 Origin 头 */
function postFrom(headerOrigin: string | null) {
  const headers = new Headers()
  if (headerOrigin !== null) headers.set('Origin', headerOrigin)
  return new Request(`${origin}/comments`, { method: 'POST', headers, body: new FormData() })
}

/** 收集一次判定抛出的 WriteAccessError；不抛时失败 */
function rejectedBy(request: Request, options: Parameters<typeof authorizeWrite>[1]) {
  try {
    authorizeWrite(request, options)
  } catch (error) {
    expect(error).toBeInstanceOf(WriteAccessError)
    return error as WriteAccessError
  }
  throw new Error('这次写入应该被拒，却放行了')
}

describe('authorizeWrite：允许与拒绝的完整矩阵', () => {
  it('Origin 头与宿主配置逐字符相等才放行；缺了、不一样、长得像的都 403', () => {
    expect(authorizeWrite(postFrom(origin), { identity: zhou, people, origin }).id).toBe('zhou')
    for (const bad of [null, 'http://127.0.0.1:5491', 'http://localhost:5490', 'http://127.0.0.1:5490.evil.example', 'HTTP://127.0.0.1:5490']) {
      const error = rejectedBy(postFrom(bad), { identity: zhou, people, origin })
      expect(error.status).toBe(403)
      expect(error.message).toContain(origin)
    }
  })

  it('请求 URL 的 host 伪造不影响判定：校验只认 Origin 头与宿主配置，不从 request.url 推导', () => {
    const forged = new Request('http://evil.example/comments', { method: 'POST', headers: { Origin: origin }, body: new FormData() })
    expect(authorizeWrite(forged, { identity: zhou, people, origin }).id).toBe('zhou')
    const forgedBoth = new Request('http://evil.example/comments', { method: 'POST', headers: { Origin: 'http://evil.example' }, body: new FormData() })
    expect(rejectedBy(forgedBoth, { identity: zhou, people, origin }).status).toBe(403)
  })

  it('没有身份时 403，消息用只读原因；身份与 people 由宿主传入，不从请求取', () => {
    const readOnly = resolveIdentity(people, undefined)
    const error = rejectedBy(postFrom(origin), { identity: readOnly, people, origin })
    expect(error.status).toBe(403)
    expect(error.message).toContain('只读')
  })

  it('as 省略（undefined/null）用当前身份；返回的人不带 codes', () => {
    for (const as of [undefined, null]) {
      const actor = authorizeWrite(postFrom(origin), { identity: zhou, people, as, origin })
      expect(actor).toEqual({ id: 'zhou', name: '小周' })
      expect('codes' in actor).toBe(false)
    }
  })

  it('as 是已登记的 agent：以那个 agent 的身份写', () => {
    for (const agent of ['claude', 'zcode']) {
      expect(authorizeWrite(postFrom(origin), { identity: zhou, people, as: agent, origin }).id).toBe(agent)
    }
  })

  it('as 空字符串、非字符串（数字、文件）、没登记过的人都是 400', () => {
    for (const as of ['', 'nobody', 123, { id: 'claude' }, new File([], 'as.txt')]) {
      const error = rejectedBy(postFrom(origin), { identity: zhou, people, as, origin })
      expect(error.status).toBe(400)
    }
  })

  it('as 写了人（不是 agent）403：人不能经接口换成别人', () => {
    const error = rejectedBy(postFrom(origin), { identity: zhou, people, as: 'li', origin })
    expect(error.status).toBe(403)
    expect(error.message).toContain('as 只给 agent 用')
  })

  it('所有拒绝路径的消息都不含人员列表里存的身份码', () => {
    const badAs: unknown[] = ['', 'nobody', 'li', 123, new File([], 'as.txt')]
    const identities = [zhou, resolveIdentity(people, undefined), resolveIdentity(people, 'nosuchcode01')]
    for (const identity of identities) {
      for (const as of [undefined, ...badAs]) {
        for (const headerOrigin of [null, 'http://evil.example']) {
          const error = rejectedBy(postFrom(headerOrigin), { identity, people, as, origin })
          expect(error.message).not.toContain('probezhou001')
        }
      }
    }
    for (const as of badAs) {
      const error = rejectedBy(postFrom(origin), { identity: zhou, people, as, origin })
      expect(error.message).not.toContain('probezhou001')
    }
  })

  it('返回的人经白名单投影：输入对象带着 codes 或多余字段也不会带出去', () => {
    const zhouWithExtra = { id: 'zhou', name: '小周', codes: ['probezhou001'], extra: 'server-only' } as Person & { codes: string[]; extra: string }
    const agentWithExtra = { id: 'claude', name: 'Claude', agent: true, extra: 'server-only' } as Person & { extra: string }
    const withExtras = [zhouWithExtra, agentWithExtra]
    expect(authorizeWrite(postFrom(origin), { identity: { person: zhouWithExtra }, people: withExtras, origin })).toEqual({ id: 'zhou', name: '小周' })
    expect(authorizeWrite(postFrom(origin), { identity: { person: zhouWithExtra }, people: withExtras, as: 'claude', origin })).toEqual({ id: 'claude', name: 'Claude', agent: true })
  })
})

describe('判定不依赖 DEV / NODE_ENV 标记', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('环境标记怎么变，允许与拒绝的结论都一致', () => {
    const environments = [
      { NODE_ENV: 'development', DEV: true },
      { NODE_ENV: 'production', DEV: false },
      { NODE_ENV: 'test', DEV: false },
    ] as const
    for (const env of environments) {
      vi.stubEnv('NODE_ENV', env.NODE_ENV)
      vi.stubEnv('DEV', env.DEV)
      expect(authorizeWrite(postFrom(origin), { identity: zhou, people, origin }).id).toBe('zhou')
      expect(rejectedBy(postFrom(null), { identity: zhou, people, origin }).status).toBe(403)
      expect(rejectedBy(postFrom(origin), { identity: resolveIdentity(people, undefined), people, origin }).status).toBe(403)
      expect(rejectedBy(postFrom(origin), { identity: zhou, people, as: '', origin }).status).toBe(400)
      expect(rejectedBy(postFrom(origin), { identity: zhou, people, as: 'li', origin }).status).toBe(403)
      expect(authorizeWrite(postFrom(origin), { identity: zhou, people, as: 'claude', origin }).id).toBe('claude')
    }
  })
})
