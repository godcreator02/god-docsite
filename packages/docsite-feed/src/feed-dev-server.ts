import type { IncomingMessage, ServerResponse } from 'node:http'
import type { Plugin } from 'vite'
import { feedEndpointPrefix, feedEvent, feedTokenEnvName, feedTokenHeader, isFeedChannel, type FeedMessage } from './feed-protocol.js'
import { feedStore } from './feed-store.js'

function readBody(request: IncomingMessage) {
  return new Promise<string>((resolve, reject) => {
    let body = ''
    request.setEncoding('utf8')
    request.on('data', (chunk: string) => (body += chunk))
    request.on('end', () => resolve(body))
    request.on('error', reject)
  })
}

function sendText(response: ServerResponse, status: number, text: string) {
  response.statusCode = status
  response.setHeader('Content-Type', 'text/plain; charset=utf-8')
  response.end(text)
}

/** 推送通道的开发服务一侧：POST 存下最新一份并经 WebSocket 告诉浏览器，GET 回最新一份（还没推过是 null）。组合包的 vite 插件把它接进 configureServer */
export function feedDevServer(): Plugin {
  return {
    name: 'docsite-feed:dev-server',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use(feedEndpointPrefix, (request, response) => {
        const channel = decodeURIComponent((request.url ?? '').replace(/^\//, '').replace(/\?.*$/, ''))
        if (!isFeedChannel(channel)) return sendText(response, 404, `频道名 ${channel} 不对：只用字母、数字、_、-`)
        if (request.method === 'GET') {
          response.setHeader('Content-Type', 'application/json; charset=utf-8')
          response.setHeader('Cache-Control', 'no-cache')
          return response.end(JSON.stringify(feedStore().get(channel) ?? null))
        }
        if (request.method !== 'POST') return sendText(response, 405, '只收 GET 与 POST')
        const token = process.env[feedTokenEnvName]
        if (!token) return sendText(response, 403, `开发服务没有 ${feedTokenEnvName}：只有 gwb-docsite 启动的开发服务收推送`)
        if (request.headers[feedTokenHeader] !== token) return sendText(response, 403, `${feedTokenHeader} 不对`)
        void readBody(request).then((body) => {
          let data: unknown
          try {
            data = JSON.parse(body)
          } catch {
            return sendText(response, 400, '正文要是 JSON')
          }
          feedStore().set(channel, data)
          const message: FeedMessage = { channel, data }
          server.ws.send({ type: 'custom', event: feedEvent, data: message })
          sendText(response, 204, '')
        }, (error: unknown) => sendText(response, 400, `读请求正文失败：${String(error)}`))
      })
    },
  }
}
