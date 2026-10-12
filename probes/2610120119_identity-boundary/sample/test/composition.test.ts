/**
 * 组合测试：不经过 HTTP，直接以 React Router action 的调用方式（构造 Request）驱动宿主接线。
 * 验证身份层与评论业务层的边界：授权失败时业务写入不发生，成功时下游收到的是可信 actor
 */
import { describe, expect, it } from 'vitest'
import { fileURLToPath } from 'node:url'
import { createSampleRoutes, type SampleHost } from '../routes.js'
import type { Comment } from '../comments.js'

const trustedOrigin = 'http://127.0.0.1:5490'
const sampleDir = fileURLToPath(new URL('../', import.meta.url))

function hostWithComments(comments: Comment[] = []): SampleHost {
  return { siteDir: sampleDir, trustedOrigin, identityCode: 'probezhou001', comments }
}

/** 按浏览器表单提交的样子构造 POST；asValue 省略时表单里就没有 as 字段 */
function formPost(fields: { body?: string; as?: string | File; actor?: string } = {}, headerOrigin: string | null = trustedOrigin) {
  const form = new FormData()
  if (fields.body !== undefined) form.set('body', fields.body)
  if (fields.as !== undefined) form.set('as', fields.as)
  if (fields.actor !== undefined) form.set('actor', fields.actor)
  const headers = new Headers()
  if (headerOrigin !== null) headers.set('Origin', headerOrigin)
  return new Request(`${trustedOrigin}/comments`, { method: 'POST', headers, body: form })
}

describe('宿主接线（React Router action 形状）', () => {
  it('合法身份写入成功：303 跳回，评论署名是身份码认出的人，不带 codes', async () => {
    const host = hostWithComments()
    const response = await createSampleRoutes(host).action({ request: formPost({ body: '第一条' }) })
    expect(response.status).toBe(303)
    expect(host.comments).toHaveLength(1)
    expect(host.comments[0]!.author).toEqual({ id: 'zhou', name: '小周' })
  })

  it('表单自报的 actor 字段被忽略：署名人只由身份码解析，不由请求声明', async () => {
    const host = hostWithComments()
    await createSampleRoutes(host).action({ request: formPost({ body: '冒充不了', actor: 'li' }) })
    expect(host.comments[0]!.author.id).toBe('zhou')
  })

  it('合法 as 代发：传给下游业务的是那个 agent', async () => {
    const host = hostWithComments()
    await createSampleRoutes(host).action({ request: formPost({ body: '代 claude 发', as: 'claude' }) })
    expect(host.comments[0]!.author).toEqual({ id: 'claude', name: 'Claude' })
  })

  it('授权失败时业务写入不发生：Origin 缺失/不对、无身份码、as 是人（403）或文件（400），评论一条都不多', async () => {
    const existing: Comment[] = [{ id: 'existing', author: { id: 'zhou', name: '小周' }, body: '已有的一条', at: '2026-10-12T00:00:00.000Z' }]
    const failures: [Request, number][] = [
      [formPost({ body: '不该出现' }, null), 403],
      [formPost({ body: '不该出现' }, 'http://evil.example'), 403],
      [formPost({ body: '不该出现', as: 'li' }), 403],
      [formPost({ body: '不该出现', as: new File([], 'as.txt') }), 400],
    ]
    for (const [request, status] of failures) {
      const host = hostWithComments([...existing])
      const response = await createSampleRoutes(host).action({ request })
      expect(response.status).toBe(status)
      expect(host.comments).toHaveLength(1)
      expect(host.comments[0]!.body).toBe('已有的一条')
    }

    const readOnly = hostWithComments()
    readOnly.identityCode = undefined
    const response = await createSampleRoutes(readOnly).action({ request: formPost({ body: '不该出现' }) })
    expect(response.status).toBe(403)
    expect(readOnly.comments).toHaveLength(0)
  })

  it('身份过了、业务输入不合法：空正文 400，评论不增加（身份层与业务层各管各的）', async () => {
    const host = hostWithComments()
    const response = await createSampleRoutes(host).action({ request: formPost({ body: '   ' }) })
    expect(response.status).toBe(400)
    expect(host.comments).toHaveLength(0)
  })

  it('所有拒绝响应的 HTML 里都不出现人员列表里存的身份码', async () => {
    const hosts = [hostWithComments(), hostWithComments()]
    hosts[1]!.identityCode = undefined
    for (const host of hosts) {
      for (const request of [formPost({ body: 'x' }, null), formPost({ body: 'x', as: 'li' }), formPost({ body: 'x', as: new File([], 'a') })]) {
        const page = await createSampleRoutes(host).action({ request })
        const html = await page.text()
        expect(html).not.toContain('probezhou001')
        expect(html).not.toContain('probeli00001')
      }
    }
  })

  it('页面 loader：公开人员列表渲染名字与 agent 标记，不出现码', async () => {
    const host = hostWithComments()
    const response = await createSampleRoutes(host).loader({ request: new Request(trustedOrigin) })
    expect(response.status).toBe(200)
    const html = await response.text()
    for (const name of ['小周', '小李', 'Claude', 'ZCode', 'agent']) expect(html).toContain(name)
    expect(html).not.toContain('probezhou001')
    expect(html).not.toContain('probeli00001')
  })
})
