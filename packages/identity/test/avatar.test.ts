import { mkdtempSync, readFileSync, rmSync, statSync, writeFileSync, mkdirSync, existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { assertAvatarImage, avatarFileInSite, avatarUrlOf, avatarWriteUrl, identityOf, webpDimensionsOf, type StoredPerson } from '../src/core/index.js'
import { handleAvatarWrite, publicPeopleWithAvatars } from '../src/node/index.js'

/** 只有文件头的 webp：RIFF…WEBP 加第一块的头，够读出宽高（服务端只读文件头，不解码） */
function webpHeader(chunk: 'VP8 ' | 'VP8L' | 'VP8X', width: number, height: number, totalBytes = 64): Uint8Array<ArrayBuffer> {
  const bytes = new Uint8Array(totalBytes)
  const view = new DataView(bytes.buffer)
  bytes.set(new TextEncoder().encode('RIFF'), 0)
  view.setUint32(4, totalBytes - 8, true)
  bytes.set(new TextEncoder().encode(`WEBP${chunk}`), 8)
  view.setUint32(16, totalBytes - 20, true)
  if (chunk === 'VP8 ') {
    bytes.set([0x9d, 0x01, 0x2a], 23)
    view.setUint16(26, width, true)
    view.setUint16(28, height, true)
  } else if (chunk === 'VP8L') {
    bytes[20] = 0x2f
    view.setUint32(21, (width - 1) | ((height - 1) << 14), true)
  } else {
    view.setUint32(24, width - 1, true)
    view.setUint32(27, height - 1, true)
  }
  return bytes
}

describe('webp 的宽高与上传头像的核对', () => {
  it('三种 webp 块都读得出宽高', () => {
    expect(webpDimensionsOf(webpHeader('VP8 ', 128, 128))).toEqual({ width: 128, height: 128 })
    expect(webpDimensionsOf(webpHeader('VP8L', 128, 96))).toEqual({ width: 128, height: 96 })
    expect(webpDimensionsOf(webpHeader('VP8X', 300, 128))).toEqual({ width: 300, height: 128 })
  })

  it('不是 webp、类型不对、太大、不是 128×128 都直接拒绝，写明原因与状态码', () => {
    const png = new Uint8Array(64).fill(0x89)
    expect(() => assertAvatarImage('image/webp', png)).toThrow('不是 webp')
    expect(() => assertAvatarImage('image/png', webpHeader('VP8L', 128, 128))).toThrow(expect.objectContaining({ status: 415 }))
    expect(() => assertAvatarImage('image/webp', webpHeader('VP8L', 128, 128, 64 * 1024 + 1))).toThrow(expect.objectContaining({ status: 413 }))
    expect(() => assertAvatarImage('image/webp', webpHeader('VP8 ', 256, 256))).toThrow('头像要是 128×128：收到 256×256')
    expect(() => assertAvatarImage('image/webp', webpHeader('VP8 ', 128, 128))).not.toThrow()
  })

  it('头像地址带文件修改时间，路径就是 public/avatars/<id>.webp 去掉 public', () => {
    expect(avatarFileInSite('zhou')).toBe('public/avatars/zhou.webp')
    expect(avatarUrlOf('zhou', 1700000000123.7)).toBe('/avatars/zhou.webp?v=1700000000123')
  })
})

const people: StoredPerson[] = [
  { id: 'zhou', name: '小周', codes: ['zhoucode0001'] },
  { id: 'claude', name: 'Claude', agent: true },
]
const origin = 'http://127.0.0.1:4000'
let siteDir = ''

function newSiteDir() {
  siteDir = mkdtempSync(path.join(tmpdir(), 'identity-avatar-'))
  return siteDir
}

afterEach(() => {
  if (siteDir !== '') rmSync(siteDir, { recursive: true, force: true })
  siteDir = ''
})

const avatarRequest = (method: string, init: { body?: Uint8Array<ArrayBuffer>; contentType?: string; requestOrigin?: string } = {}) =>
  new Request(`${origin}${avatarWriteUrl}`, {
    method,
    headers: { origin: init.requestOrigin ?? origin, ...(init.contentType ? { 'content-type': init.contentType } : {}) },
    ...(init.body ? { body: init.body } : {}),
  })

describe('站点里的头像文件', () => {
  it('publicPeopleWithAvatars：有文件的人带上头像地址，没有的不带；身份码不出去', () => {
    const dir = newSiteDir()
    mkdirSync(path.join(dir, 'public', 'avatars'), { recursive: true })
    writeFileSync(path.join(dir, avatarFileInSite('claude')), webpHeader('VP8L', 128, 128))
    const mtime = statSync(path.join(dir, avatarFileInSite('claude'))).mtimeMs
    expect(publicPeopleWithAvatars(dir, people)).toEqual([
      { id: 'zhou', name: '小周' },
      { id: 'claude', name: 'Claude', agent: true, avatar: avatarUrlOf('claude', mtime) },
    ])
  })

  it('handleAvatarWrite：PUT 存成本机身份那个人的头像、回新地址，DELETE 删掉回 null', async () => {
    const dir = newSiteDir()
    const options = { siteDir: dir, people, identity: identityOf(people, 'zhoucode0001'), trustedOrigin: origin }
    const image = webpHeader('VP8 ', 128, 128)
    const uploaded = await handleAvatarWrite({ ...options, request: avatarRequest('PUT', { body: image, contentType: 'image/webp' }) })
    expect(uploaded.status).toBe(200)
    const file = path.join(dir, avatarFileInSite('zhou'))
    expect((await uploaded.json()) as unknown).toEqual({ avatar: avatarUrlOf('zhou', statSync(file).mtimeMs) })
    expect(new Uint8Array(readFileSync(file))).toEqual(image)
    const removed = await handleAvatarWrite({ ...options, request: avatarRequest('DELETE') })
    expect((await removed.json()) as unknown).toEqual({ avatar: null })
    expect(existsSync(file)).toBe(false)
    const removedAgain = await handleAvatarWrite({ ...options, request: avatarRequest('DELETE') })
    expect([removedAgain.status, await removedAgain.text()]).toEqual([404, 'zhou 没有头像（public/avatars/zhou.webp 不在）\n'])
  })

  it('handleAvatarWrite：来源不对、没有本机身份、图不合格、别的方法都拒绝，不写文件', async () => {
    const dir = newSiteDir()
    const options = { siteDir: dir, people, identity: identityOf(people, 'zhoucode0001'), trustedOrigin: origin }
    const good = { body: webpHeader('VP8 ', 128, 128), contentType: 'image/webp' }
    const statusOf = async (response: Promise<Response>) => (await response).status
    expect(await statusOf(handleAvatarWrite({ ...options, request: avatarRequest('PUT', { ...good, requestOrigin: 'http://evil.example' }) }))).toBe(403)
    expect(await statusOf(handleAvatarWrite({ ...options, identity: identityOf(people, undefined), request: avatarRequest('PUT', good) }))).toBe(403)
    expect(await statusOf(handleAvatarWrite({ ...options, request: avatarRequest('PUT', { body: webpHeader('VP8 ', 64, 64), contentType: 'image/webp' }) }))).toBe(400)
    expect(await statusOf(handleAvatarWrite({ ...options, request: avatarRequest('POST', good) }))).toBe(405)
    expect(existsSync(path.join(dir, 'public'))).toBe(false)
  })
})
