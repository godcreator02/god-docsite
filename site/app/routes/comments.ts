import { commentRequestResponse, commentSourceResponse } from '@godcreator/docsite-kit/server'
import { pageCommenter } from '../lib/commenter.server'
import { source } from '../lib/source'
import type { Route } from './+types/comments'

/** 编辑评论时取原文；发布站只读，不给 */
export async function loader({ request }: Route.LoaderArgs) {
  if (!(await pageCommenter())) return new Response('这个站只读', { status: 403 })
  return commentSourceResponse(request)
}

/** 新建、回复、编辑、删除、解决、重新打开：只改 comments/ 里的文件 */
export async function action({ request }: Route.ActionArgs) {
  return commentRequestResponse(request, { commenter: await pageCommenter(), pageUrls: source.getPages().map((page) => page.url) })
}
