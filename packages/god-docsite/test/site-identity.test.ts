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

  it('写出来的读得回，文件里只有 kind、audience 与 format', () => {
    expect(writeSiteIdentity(siteDir, 'collab', 'shared')).toEqual({ kind: 'collab', audience: 'shared', format: 2 })
    expect(siteIdentityOf(siteDir)).toEqual({ kind: 'collab', audience: 'shared', format: 2 })
    expect(readFileSync(siteIdentityFileOf(siteDir), 'utf8')).toBe('{\n  "kind": "collab",\n  "audience": "shared",\n  "format": 2\n}\n')
  })

  it('没有身份文件为 null', () => {
    expect(siteIdentityOf(siteDir)).toBeNull()
  })

  it('写坏了直接报错，写明哪里不对', () => {
    const file = siteIdentityFileOf(siteDir)
    writeFileSync(file, '{ "kind": "collab",')
    expect(() => siteIdentityOf(siteDir)).toThrow(/不是合法的 JSON/)
    expect(() => parseSiteIdentity('[]', file)).toThrow(/要是一个对象/)
    expect(() => parseSiteIdentity('{"kind":"wiki","audience":"shared","format":2}', file)).toThrow(/kind 要是 base \/ docs \/ collab 之一，收到 "wiki"/)
    expect(() => parseSiteIdentity('{"kind":"docs","format":1}', file)).toThrow(/format 是 1，这一版平台只认第 2 代布局：用 gwb-docsite 的 docsite.site.upgrade/)
    expect(() => parseSiteIdentity('{"kind":"docs","audience":"shared"}', file)).toThrow(/format 是 undefined/)
    expect(() => parseSiteIdentity('{"kind":"docs","format":2}', file)).toThrow(/audience 要是 personal \/ shared 之一，收到 undefined/)
    expect(() => parseSiteIdentity('{"kind":"docs","audience":"team","format":2}', file)).toThrow(/audience 要是 personal \/ shared 之一，收到 "team"/)
    expect(() => parseSiteIdentity('{"kind":"collab","audience":"personal","format":2}', file)).toThrow(/协作站（kind 为 collab）的 audience 只能是 shared/)
    expect(() => parseSiteIdentity('{"kind":"docs","audience":"shared","format":2,"title":"站"}', file)).toThrow(/认不出的键 title/)
  })

  it('写的时候 kind、audience 认不出就拒绝，协作站不许写 personal', () => {
    expect(() => writeSiteIdentity(siteDir, 'wiki' as 'base', 'shared')).toThrow(/kind 要是 base \/ docs \/ collab 之一/)
    expect(() => writeSiteIdentity(siteDir, 'base', 'team' as 'shared')).toThrow(/audience 要是 personal \/ shared 之一/)
    expect(() => writeSiteIdentity(siteDir, 'collab', 'personal')).toThrow(/协作站（kind 为 collab）的 audience 只能是 shared/)
  })
})
