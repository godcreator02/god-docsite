import { createReadStream } from 'node:fs'
import { realpath, stat } from 'node:fs/promises'
import path from 'node:path'
import { Readable } from 'node:stream'

const contentTypeOfExtension: Record<string, string> = {
  '.avif': 'image/avif',
  '.gif': 'image/gif',
  '.jpeg': 'image/jpeg',
  '.jpg': 'image/jpeg',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
  '.pdf': 'application/pdf',
  '.mp3': 'audio/mpeg',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.csv': 'text/csv; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
}

function notFound(message: string): Response {
  return new Response(message, { status: 404 })
}

function isMissingPathError(error: unknown): boolean {
  const code = (error as NodeJS.ErrnoException).code
  return code === 'ENOENT' || code === 'ENOTDIR'
}

/** target 是 root 里面的路径（不是 root 本身）；两个都已经是 realpath */
function isInsideDir(root: string, target: string): boolean {
  const relative = path.relative(root, target)
  return relative !== '' && relative !== '..' && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative)
}

/**
 * 功能包文件路由的响应：dir 里的一个文件，类型按扩展名给。不存在、越出 dir（含符号链接指出去的）、不是普通文件、认不出扩展名，都抛 404 的 Response。
 * 浏览器每次都来问（no-cache），ETag 由大小与修改时间算出，没变回 304、不再传文件
 */
export async function externalFileResponse(dir: string, relativePath: string, request: Request): Promise<Response> {
  const contentType = contentTypeOfExtension[path.extname(relativePath).toLowerCase()]
  if (contentType === undefined) throw notFound(`不提供 ${relativePath}：认不出这种扩展名，认得的有 ${Object.keys(contentTypeOfExtension).join(' ')}`)
  const root = await realpath(dir)
  let file: string
  try {
    file = await realpath(path.join(root, relativePath))
  } catch (error) {
    if (isMissingPathError(error)) throw notFound(`没有文件 ${relativePath}`)
    throw error
  }
  const stats = await stat(file)
  if (!isInsideDir(root, file) || !stats.isFile()) throw notFound(`没有文件 ${relativePath}`)
  const headers = { 'content-type': contentType, 'cache-control': 'no-cache', etag: `"${stats.size.toString(16)}-${Math.trunc(stats.mtimeMs).toString(16)}"` }
  if (request.headers.get('if-none-match') === headers.etag) return new Response(null, { status: 304, headers })
  return new Response(Readable.toWeb(createReadStream(file)) as ReadableStream, { headers })
}
