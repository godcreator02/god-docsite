/**
 * HTTP 组合测试：起真实的 Node 服务（端口由系统分配，不占用 5490/5491），
 * 用全局 fetch 走完整链路——浏览器表单提交就是这个样子
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { fileURLToPath } from 'node:url'
import { startIdentitySampleServer, type StartedSampleServer } from '../http-server.js'

const sampleDir = fileURLToPath(new URL('../', import.meta.url))
let writable: StartedSampleServer
let readonly: StartedSampleServer

beforeAll(async () => {
  writable = await startIdentitySampleServer({ port: 0, identityCode: 'probezhou001', siteDir: sampleDir })
  readonly = await startIdentitySampleServer({ port: 0, siteDir: sampleDir })
})

afterAll(async () => {
  writable.server.close()
  readonly.server.close()
})

async function postComment(server: StartedSampleServer, fields: { body?: string; as?: string }, withOrigin: boolean) {
  const form = new FormData()
  if (fields.body !== undefined) form.set('body', fields.body)
  if (fields.as !== undefined) form.set('as', fields.as)
  form.set('actor', 'li')
  const headers: HeadersInit = {}
  if (withOrigin) (headers as Record<string, string>).Origin = server.origin
  return fetch(`${server.origin}/comments`, { method: 'POST', headers, body: form, redirect: 'manual' })
}

describe('HTTP 链路：可写宿主', () => {
  it('GET / 是页面：人员公开列表渲染名字，不出现码；样式文件可取', async () => {
    const page = await fetch(`${writable.origin}/`)
    expect(page.status).toBe(200)
    const html = await page.text()
    expect(html).toContain('小周')
    expect(html).toContain('身份边界组合样本')
    expect(html).not.toContain('probezhou001')
    expect(html).not.toContain('probeli00001')
    expect((await fetch(`${writable.origin}/identity.css`)).status).toBe(200)
    expect((await fetch(`${writable.origin}/sample.css`)).status).toBe(200)
  })

  it('带正确 Origin 的表单提交成功：303 跳回，页面能看到新评论与署名人', async () => {
    const accepted = await postComment(writable, { body: 'http 链路的第一条' }, true)
    expect(accepted.status).toBe(303)
    const html = await (await fetch(`${writable.origin}/`)).text()
    expect(html).toContain('http 链路的第一条')
    expect(html).toContain('小周')
  })

  it('自报 actor=li 无效：署名还是身份码认出的小周', async () => {
    await postComment(writable, { body: '第二条' }, true)
    const html = await (await fetch(`${writable.origin}/`)).text()
    expect(html).toContain('小李') // 人员列表本身有小李
    const zhouCount = html.split('小周').length - 1
    expect(zhouCount).toBeGreaterThanOrEqual(2)
  })

  it('Origin 缺失或不对：403，业务写入不发生（页面看不到这条评论），响应不含码', async () => {
    for (const withOrigin of [false]) {
      const rejected = await postComment(writable, { body: '不该写进去的一条' }, withOrigin)
      expect(rejected.status).toBe(403)
      const body = await rejected.text()
      expect(body).not.toContain('probezhou001')
    }
    const evilForm = new FormData()
    evilForm.set('body', '也不该写进去')
    const evil = await fetch(`${writable.origin}/comments`, {
      method: 'POST',
      headers: { Origin: 'http://evil.example' },
      body: evilForm,
      redirect: 'manual',
    })
    expect(evil.status).toBe(403)
    const html = await (await fetch(`${writable.origin}/`)).text()
    expect(html).not.toContain('不该写进去的一条')
    expect(html).not.toContain('也不该写进去')
  })
})

describe('HTTP 链路：只读宿主', () => {
  it('页面正常渲染（只读身份标识）；写请求一律 403，原因写明只读，响应不含码', async () => {
    const html = await (await fetch(`${readonly.origin}/`)).text()
    expect(html).toContain('只读')
    const rejected = await postComment(readonly, { body: '只读站点写不进' }, true)
    expect(rejected.status).toBe(403)
    const body = await rejected.text()
    expect(body).toContain('只读')
    expect(body).not.toContain('probezhou001')
    const after = await (await fetch(`${readonly.origin}/`)).text()
    expect(after).not.toContain('只读站点写不进')
  })
})
