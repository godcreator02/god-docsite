import { describe, expect, it } from 'vitest'
import { optionValueOf, siteOrigin } from '../src/site/origin.server.js'

describe('optionValueOf', () => {
  it('认 --port 4000 与 --port=4000，没写是 undefined，不带值是空串', () => {
    expect(optionValueOf(['dev', '--port', '4000'], '--port')).toBe('4000')
    expect(optionValueOf(['dev', '--port=4001'], '--port')).toBe('4001')
    expect(optionValueOf(['dev'], '--port')).toBeUndefined()
    expect(optionValueOf(['dev', '--host', '--port', '1'], '--host')).toBe('')
  })
})

describe('siteOrigin', () => {
  it('设了 DOCSITE_ORIGIN 就只认它，带路径报错', () => {
    expect(siteOrigin('dev', { argv: [], env: { DOCSITE_ORIGIN: 'https://docs.example.com' } })).toBe('https://docs.example.com')
    expect(() => siteOrigin('dev', { argv: [], env: { DOCSITE_ORIGIN: 'https://docs.example.com/' } })).toThrow(/只写 origin/)
    expect(() => siteOrigin('dev', { argv: [], env: { DOCSITE_ORIGIN: 'nope' } })).toThrow(/不是网址/)
  })

  it('dev 取启动参数的 --port 与 --host，没写主机或监听全部网卡时是 localhost', () => {
    expect(siteOrigin('dev', { argv: ['node', 'react-router', 'dev', '--host', '127.0.0.1', '--port', '5180'], env: {} })).toBe('http://127.0.0.1:5180')
    expect(siteOrigin('dev', { argv: ['dev', '--port=5181'], env: {} })).toBe('http://localhost:5181')
    expect(siteOrigin('dev', { argv: ['dev', '--host', '--port', '5182'], env: {} })).toBe('http://localhost:5182')
    expect(() => siteOrigin('dev', { argv: ['dev'], env: {} })).toThrow(/--port/)
  })

  it('start 取环境变量 PORT 与 HOST，没设 PORT 报错', () => {
    expect(siteOrigin('start', { argv: [], env: { PORT: '5190', HOST: '127.0.0.1' } })).toBe('http://127.0.0.1:5190')
    expect(siteOrigin('start', { argv: [], env: { PORT: '5191' } })).toBe('http://localhost:5191')
    expect(() => siteOrigin('start', { argv: ['--port', '1'], env: {} })).toThrow(/PORT/)
  })
})
