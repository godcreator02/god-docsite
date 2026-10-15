import { describe, expect, it } from 'vitest'
import { siteOrigin } from '../src/site/origin.server.js'

describe('siteOrigin', () => {
  it('设了 DOCSITE_ORIGIN 就只认它，带路径报错', () => {
    expect(siteOrigin('dev', { env: { DOCSITE_ORIGIN: 'https://docs.example.com', DOCSITE_DEV_ORIGIN: 'http://localhost:12345' } })).toBe('https://docs.example.com')
    expect(() => siteOrigin('dev', { env: { DOCSITE_ORIGIN: 'https://docs.example.com/' } })).toThrow(/只写 origin/)
    expect(() => siteOrigin('dev', { env: { DOCSITE_ORIGIN: 'nope' } })).toThrow(/不是网址/)
  })

  it('dev 取平台 vite 插件写的 DOCSITE_DEV_ORIGIN，没有就报错', () => {
    expect(siteOrigin('dev', { env: { DOCSITE_DEV_ORIGIN: 'http://127.0.0.1:23456' } })).toBe('http://127.0.0.1:23456')
    expect(() => siteOrigin('dev', { env: {} })).toThrow(/godDocsite\(\)/)
  })

  it('start 取环境变量 PORT 与 HOST，没设 PORT 报错', () => {
    expect(siteOrigin('start', { env: { PORT: '15190', HOST: '127.0.0.1' } })).toBe('http://127.0.0.1:15190')
    expect(siteOrigin('start', { env: { PORT: '15191' } })).toBe('http://localhost:15191')
    expect(() => siteOrigin('start', { env: { DOCSITE_DEV_ORIGIN: 'http://localhost:1' } })).toThrow(/PORT/)
  })
})
