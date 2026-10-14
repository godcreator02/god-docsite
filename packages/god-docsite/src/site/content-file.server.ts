import type { LoaderFunctionArgs } from 'react-router'
import { contentFileResponse } from '../node/content-files.js'
import type { DocsiteContext } from './site-context.js'

/**
 * 资源路由 api/content/* 的 loader：dev 下读内容目录。start 下构建产物里已有同一批文件（godDocsite 的构建收尾复制），
 * 静态文件先命中；落到这里的是构建时没有的路径，按快照回 404，不读构建之后才加进内容目录的文件
 */
export async function contentFileLoader({ params }: LoaderFunctionArgs, { mode, contentDir }: Pick<DocsiteContext, 'mode' | 'contentDir'>): Promise<Response> {
  if (mode === 'start') return new Response('Not found', { status: 404 })
  return contentFileResponse(decodeURIComponent(params['*'] ?? ''), contentDir)
}
