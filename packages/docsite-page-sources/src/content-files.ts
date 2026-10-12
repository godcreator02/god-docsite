import { cp, mkdir, readdir, readFile } from 'node:fs/promises'
import { dirname, extname, join, resolve, sep } from 'node:path'

/**
 * HTML 页面与它引用的同目录资源在网页上的地址规则：HTML 原样展示，浏览器把文档地址当作解析相对引用的基准，
 * 所以只要文件按原路径送出（/api/content/ 前缀 + content 里的相对路径），页面里的相对图片、样式地址不用改写。
 * dev 时由 /api/content/* 服务端路由读 content 源目录（contentFileResponse）；
 * build 时由 copyContentAssetsToBuild 把同一批文件复制成客户端静态资产，start 只读产物——
 * 两边覆盖的扩展名是同一张 contentTypes 表，HTML 正文与构建时的标题/搜索索引来自同一份快照
 */

export const contentFileUrlPrefix = '/api/content/'

/** glob 给的路径（/content/guide/waveform.html）在网页上的地址（/api/content/guide/waveform.html） */
export function contentFileUrlOf(file: string, contentDir = '/content') {
  if (!file.startsWith(`${contentDir}/`)) throw new Error(`${file} 不在 ${contentDir} 下`)
  return `${contentFileUrlPrefix}${file.slice(contentDir.length + 1)}`
}

const contentTypes: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript',
  '.mjs': 'text/javascript',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.avif': 'image/avif',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8',
  '.md': 'text/markdown; charset=utf-8',
}

/**
 * /api/content/ 请求的服务端响应（dev 用）：从磁盘上的 content 目录读文件送出。
 * 解析后的绝对路径必须还在 contentDir 下，出了边界（如 ../）直接 404
 */
export async function contentFileResponse(urlPath: string, contentDir: string): Promise<Response> {
  const absolute = resolve(contentDir, urlPath.replaceAll('\\', '/'))
  const contentRoot = resolve(contentDir)
  if (absolute !== contentRoot && !absolute.startsWith(contentRoot + sep)) return new Response('Not found', { status: 404 })
  try {
    const body = await readFile(absolute)
    return new Response(body, { headers: { 'content-type': contentTypes[extname(absolute).toLowerCase()] ?? 'application/octet-stream' } })
  } catch {
    return new Response('Not found', { status: 404 })
  }
}

/**
 * build 时把 content 里可被 /api/content/ 服务的文件复制成客户端静态资产
 * （clientOutDir/api/content/<content 里的相对路径>），start 下静态文件接管这些地址。
 * 复制范围就是 contentTypes 的扩展名：HTML 页面与 HTML/TSX 页面引用的图片、字体等资产；
 * 内容源（.mdx/.tsx/.json 的 meta）不进产物。在 Vite 插件的 client 环境收尾钩子里调用
 */
export async function copyContentAssetsToBuild(contentDir: string, clientOutDir: string): Promise<string[]> {
  const extensions = new Set(Object.keys(contentTypes))
  const copied: string[] = []
  async function walk(dir: string) {
    for (const entry of await readdir(dir, { withFileTypes: true })) {
      const full = join(dir, entry.name)
      if (entry.isDirectory()) await walk(full)
      else if (extensions.has(extname(entry.name).toLowerCase())) {
        const relative = relativePathOf(contentDir, full)
        const target = join(clientOutDir, contentFileUrlPrefix.slice(1), relative)
        await mkdir(dirname(target), { recursive: true })
        await cp(full, target)
        copied.push(relative)
      }
    }
  }
  await walk(contentDir)
  return copied
}

function relativePathOf(fromDir: string, fullPath: string) {
  const relative = fullPath.slice(resolve(fromDir).length + 1)
  return relative.replaceAll('\\', '/')
}
