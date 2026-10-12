import { createServer, type Server } from 'node:http'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { postComment } from '../src/react/comment-cards.js'

/**
 * 写成功回调 onWritten 的契约：一次写入真正成功（接口 2xx、解出 thread/file）后调一次并传回写入结果；
 * 失败的请求（非 2xx）不调，postComment 照常抛错。postComment 是浏览器函数，但只依赖 fetch/FormData，
 * 用一个真实的本地 HTTP 服务验证，不起浏览器
 */
describe('postComment 的写成功回调', () => {
  let server: Server
  let url: string
  let statusToSend = 200

  beforeEach(async () => {
    statusToSend = 200
    server = createServer((request, response) => {
      const chunks: Buffer[] = []
      request.on('data', (chunk: Buffer) => chunks.push(chunk))
      request.on('end', () => {
        if (statusToSend !== 200) {
          response.writeHead(statusToSend, { 'Content-Type': 'text/plain; charset=utf-8' })
          response.end('接口拒绝')
          return
        }
        response.writeHead(200, { 'Content-Type': 'application/json' })
        response.end(JSON.stringify({ thread: '2026-10-12-x', file: 'index.mdx' }))
      })
    })
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
    url = `http://127.0.0.1:${(server.address() as { port: number }).port}/api/comments`
  })

  afterEach(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()))
  })

  it('成功写入后调一次，带回接口返回的 thread 与 file', async () => {
    const written: Array<{ thread: string; file: string }> = []
    const result = await postComment({ url, onWritten: (one) => written.push(one) }, { op: 'create', body: '内容' })
    expect(result).toEqual({ thread: '2026-10-12-x', file: 'index.mdx' })
    expect(written).toEqual([{ thread: '2026-10-12-x', file: 'index.mdx' }])
  })

  it('接口拒绝时 postComment 抛错，onWritten 不调', async () => {
    statusToSend = 400
    const written: unknown[] = []
    await expect(postComment({ url, onWritten: () => written.push('不应发生') }, { op: 'create', body: '内容' })).rejects.toThrow('接口拒绝')
    expect(written).toEqual([])
  })

  it('不传 onWritten 也照常工作', async () => {
    const result = await postComment({ url }, { op: 'reply', thread: 't', body: '内容' })
    expect(result.file).toBe('index.mdx')
  })
})
