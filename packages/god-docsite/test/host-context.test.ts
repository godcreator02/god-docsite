import { afterEach, describe, expect, it } from 'vitest'
import { feedTokenEnvName, feedTokenHeader } from '../src/core/feed'
import { hostChannel, parseHostContext, type HostContext } from '../src/core/host-context'
import { readerFontsCssOf } from '../src/core/reader-fonts'
import { feedHub } from '../src/node/feed-hub'
import { feedAction } from '../src/site/feed.server'
import { siteHostContext, siteProvidedDirs } from '../src/site/host-context.server'
import { readerFontsCss } from '../src/site/reader-fonts.server'

const context: HostContext = {
  format: 1,
  identityCode: 'mycode000001',
  dirs: { papers: 'D:/library/papers' },
  readerFonts: { body: 'Sarasa Mono SC', heading: null, mono: null },
}

afterEach(() => {
  feedHub().latest.delete(hostChannel)
  delete process.env[feedTokenEnvName]
})

describe('readerFontsCssOf：三项字体换成 :root 变量', () => {
  it('只写设了的项，名字后面接后备字体', () => {
    expect(readerFontsCssOf({ body: 'Sarasa Mono SC', heading: null, mono: 'Sarasa Mono SC' })).toBe(
      ':root { --font-sans: "Sarasa Mono SC", ui-sans-serif, system-ui, sans-serif; --font-mono: "Sarasa Mono SC", ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; }',
    )
  })

  it('只设标题时只出 --font-heading；三项都没设回 null', () => {
    expect(readerFontsCssOf({ body: null, heading: 'Noto Serif SC', mono: null })).toBe(':root { --font-heading: "Noto Serif SC", ui-sans-serif, system-ui, sans-serif; }')
    expect(readerFontsCssOf({ body: null, heading: null, mono: null })).toBeNull()
  })
})

describe('parseHostContext：推进频道 host 的值', () => {
  it('写对了原样收下；dirs 可以不写（shared 站）', () => {
    expect(parseHostContext(context)).toEqual(context)
    const { dirs: _dirs, ...shared } = context
    expect(parseHostContext(shared)).toEqual(shared)
  })

  it.each([
    [[], '要是一个对象'],
    [{ ...context, format: 2 }, 'format 要是 1，收到 2'],
    [{ ...context, port: 1 }, '不认识的字段：port'],
    [{ ...context, identityCode: '' }, 'identityCode 要是非空字符串'],
    [{ ...context, dirs: { papers: 3 } }, 'dirs 要是「名字: 绝对路径」的对象'],
    [{ ...context, readerFonts: { body: null, heading: null } }, 'readerFonts.mono 要是 null 或能放进 CSS 的字体名，收到 undefined'],
    [{ ...context, readerFonts: { body: 'A"; } body { color: red', heading: null, mono: null } }, 'readerFonts.body 要是 null 或能放进 CSS 的字体名'],
    [{ ...context, readerFonts: { body: null, heading: 'x</style><script>', mono: null } }, 'readerFonts.heading'],
    [{ ...context, readerFonts: { body: null, heading: null, mono: null, size: 14 } }, 'readerFonts 有不认识的字段：size'],
  ])('写错了报错：%j', (value, message) => {
    expect(() => parseHostContext(value)).toThrow(message)
  })
})

describe('站点读托管方上下文', () => {
  const push = (data: unknown) =>
    feedAction({
      request: new Request('http://127.0.0.1/__docsite/feed/host', { method: 'POST', headers: { [feedTokenHeader]: 'token1' }, body: JSON.stringify(data) }),
      params: { channel: hostChannel },
      context: {},
    } as unknown as Parameters<typeof feedAction>[0])

  it('没推过：没有上下文、没有本机目录、默认字体', () => {
    expect(siteHostContext()).toBeNull()
    expect(siteProvidedDirs()).toEqual({})
    expect(readerFontsCss()).toBeNull()
  })

  it('推进来以后每次读现在的值；写错了的推送回 400，频道里的值不变', async () => {
    process.env[feedTokenEnvName] = 'token1'
    expect((await push(context)).status).toBe(204)
    expect(siteHostContext()).toEqual(context)
    expect(siteProvidedDirs()).toEqual({ papers: 'D:/library/papers' })
    expect(readerFontsCss()).toContain('--font-sans: "Sarasa Mono SC"')
    const rejected = await push({ ...context, format: 2 })
    expect(rejected.status).toBe(400)
    expect(await rejected.text()).toContain('format 要是 1')
    expect(siteHostContext()).toEqual(context)
  })
})
