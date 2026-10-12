import { contentFileResponse } from '@probe/page-sources/server'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

/** content 源目录在磁盘上的位置：dev 下 /api/content/ 请求从这里读文件 */
const contentDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../content')

/**
 * dev 专用路由：读 content 源目录。build 时 vite 插件已把同一批文件复制成客户端静态资产，
 * 静态文件优先命中；落到这里的都是构建时没有的路径，按快照语义直接 404——
 * build 后 content 源里新增或修改的文件不会出现在 start 的站上（标题/索引也是构建时的）
 */
export async function loader({ params }: { params: { '*': string } }) {
  if (import.meta.env.PROD) throw new Response('Not found', { status: 404 })
  return contentFileResponse(decodeURIComponent(params['*']), contentDir)
}
