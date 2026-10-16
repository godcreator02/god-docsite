import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { parseSiteIdentity, siteIdentityFileOf, siteIdentityOf, writeSiteIdentity } from '../src/node/site-identity.js'

describe('站点身份文件 docsite.json', () => {
  let siteDir: string
  beforeEach(() => {
    siteDir = mkdtempSync(path.join(tmpdir(), 'site-identity-'))
  })
  afterEach(() => {
    rmSync(siteDir, { recursive: true, force: true })
  })

  it('写出来的读得回，文件里只有 kind 与 format', () => {
    expect(writeSiteIdentity(siteDir, 'collab')).toEqual({ kind: 'collab', format: 1 })
    expect(siteIdentityOf(siteDir)).toEqual({ kind: 'collab', format: 1 })
    expect(readFileSync(siteIdentityFileOf(siteDir), 'utf8')).toBe('{\n  "kind": "collab",\n  "format": 1\n}\n')
  })

  it('没有身份文件为 null', () => {
    expect(siteIdentityOf(siteDir)).toBeNull()
  })

  it('写坏了直接报错，写明哪里不对', () => {
    const file = siteIdentityFileOf(siteDir)
    writeFileSync(file, '{ "kind": "collab",')
    expect(() => siteIdentityOf(siteDir)).toThrow(/不是合法的 JSON/)
    expect(() => parseSiteIdentity('[]', file)).toThrow(/要是一个对象/)
    expect(() => parseSiteIdentity('{"kind":"wiki","format":1}', file)).toThrow(/kind 要是 base \/ docs \/ collab 之一，收到 "wiki"/)
    expect(() => parseSiteIdentity('{"kind":"docs","format":2}', file)).toThrow(/format 是 2，这一版平台只认第 1 代布局/)
    expect(() => parseSiteIdentity('{"kind":"docs"}', file)).toThrow(/format 是 undefined/)
    expect(() => parseSiteIdentity('{"kind":"docs","format":1,"title":"站"}', file)).toThrow(/认不出的键 title/)
  })

  it('写的时候 kind 认不出就拒绝', () => {
    expect(() => writeSiteIdentity(siteDir, 'wiki' as 'base')).toThrow(/kind 要是 base \/ docs \/ collab 之一/)
  })
})
