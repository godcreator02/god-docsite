import type { IncomingMessage, ServerResponse } from 'node:http'
import { readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import type { Plugin } from 'vite'
import type { CollabData, Comment, CommentAnchor } from './data.ts'

const pageKeyPattern = /^pages(\/[a-z0-9][a-z0-9-]*)+$/

class BadRequest extends Error {}

function readJsonBody(req: IncomingMessage): Promise<Record<string, unknown>> {
  return new Promise((resolve, reject) => {
    let raw = ''
    req.on('data', (chunk) => (raw += chunk))
    req.on('end', () => {
      try {
        resolve(JSON.parse(raw))
      } catch {
        reject(new BadRequest('请求体不是合法 JSON'))
      }
    })
    req.on('error', reject)
  })
}

function requireString(body: Record<string, unknown>, field: string): string {
  const value = body[field]
  if (typeof value !== 'string' || value.trim() === '') throw new BadRequest(`缺少字段 ${field}，或它不是非空字符串`)
  return value.trim()
}

function today() {
  const now = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
}

async function updateCollabFile(root: string, pageKey: string, change: (data: CollabData) => void) {
  if (!pageKeyPattern.test(pageKey)) throw new BadRequest(`页面标识不合法：${pageKey}`)
  const file = path.join(root, `${pageKey}.collab.json`)
  let data: CollabData
  try {
    data = JSON.parse(await readFile(file, 'utf8'))
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error
    data = { comments: [], tasks: [] }
  }
  change(data)
  await writeFile(file, `${JSON.stringify(data, null, 2)}\n`, 'utf8')
}

function findComment(data: CollabData, id: string): Comment {
  const comment = data.comments.find((c) => c.id === id)
  if (!comment) throw new BadRequest(`没有 id 为 ${id} 的批注`)
  return comment
}

async function handle(root: string, action: string, body: Record<string, unknown>) {
  const page = requireString(body, 'page')
  if (action === '/comments') {
    const anchor = body.anchor as CommentAnchor | undefined
    if (!anchor || (!anchor.selector && !anchor.quote)) throw new BadRequest('anchor 至少要有 selector 或 quote')
    const author = requireString(body, 'author')
    const text = requireString(body, 'text')
    await updateCollabFile(root, page, (data) => {
      const nextNumber = Math.max(0, ...data.comments.map((c) => Number(c.id.replace(/^c/, '')) || 0)) + 1
      data.comments.push({ id: `c${nextNumber}`, anchor, author, createdAt: today(), status: 'open', text, replies: [] })
    })
    return
  }
  if (action === '/comments/reply') {
    const id = requireString(body, 'id')
    const author = requireString(body, 'author')
    const text = requireString(body, 'text')
    await updateCollabFile(root, page, (data) => findComment(data, id).replies.push({ author, createdAt: today(), text }))
    return
  }
  if (action === '/comments/status') {
    const id = requireString(body, 'id')
    const status = requireString(body, 'status')
    if (status !== 'open' && status !== 'resolved') throw new BadRequest(`status 只能是 open 或 resolved，收到 ${status}`)
    await updateCollabFile(root, page, (data) => (findComment(data, id).status = status))
    return
  }
  throw new BadRequest(`没有这个接口：${action}`)
}

/** 开发服务上的批注写入接口：只在 vite dev 时存在，把改动写回页面旁边的 .collab.json */
export function collabDevApi(): Plugin {
  let root = ''
  return {
    name: 'collab-dev-api',
    apply: 'serve',
    configResolved(config) {
      root = config.root
    },
    configureServer(server) {
      server.middlewares.use('/__collab', async (req: IncomingMessage, res: ServerResponse) => {
        if (req.method !== 'POST') {
          res.statusCode = 405
          res.end('只接受 POST')
          return
        }
        try {
          await handle(root, req.url ?? '', await readJsonBody(req))
          res.statusCode = 204
          res.end()
        } catch (error) {
          res.statusCode = error instanceof BadRequest ? 400 : 500
          res.setHeader('content-type', 'text/plain; charset=utf-8')
          res.end(error instanceof Error ? error.message : String(error))
        }
      })
    },
  }
}
