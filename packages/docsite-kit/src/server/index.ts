import { readFile } from 'node:fs/promises'
import path from 'node:path'

export { siteSearchServer } from './search.js'
export { commentablePagesOf, commentRequestResponse, commentSourceResponse, currentCommenter, siteCommenter, type CommentablePage, type CommentOperation } from './comments.js'

/**
 * 只在服务端用的函数：项目骨架里路由文件的 loader 调用它们，像 fumadocs 模板里 search.ts 调用 createFromSource 一样。
 * 站点目录是进程的当前目录：开发服务（react-router dev）与发布出去的服务（react-router-serve）都在站点目录里启动
 */

const contentTypeOf: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.txt': 'text/plain; charset=utf-8',
  '.csv': 'text/csv; charset=utf-8',
}

/**
 * 原样送出内容目录里的一个文件：HTML 页面放在 iframe 里由它送出，页面里相对路径的图片、样式也经它取。
 * relativePath 是 /api/content/ 后面那一段。只送内容目录里面的文件；每次都重新读，本机改了 HTML 刷新就能看到
 */
export async function contentFileResponse(relativePath: string, contentDir = path.resolve(process.cwd(), 'content')): Promise<Response> {
  const file = path.resolve(contentDir, relativePath)
  if (!file.startsWith(`${contentDir}${path.sep}`)) return new Response('只能读 content/ 里的文件', { status: 400 })
  const contentType = contentTypeOf[path.extname(file).toLowerCase()]
  if (!contentType) return new Response(`不送 ${path.extname(file) || '没有扩展名'} 的文件`, { status: 415 })
  let content: Buffer
  try {
    content = await readFile(file)
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return new Response(`content/${relativePath} 不在`, { status: 404 })
    throw error
  }
  return new Response(new Uint8Array(content), { headers: { 'Content-Type': contentType, 'Cache-Control': 'no-cache' } })
}
