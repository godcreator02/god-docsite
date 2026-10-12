import type { ActionFunctionArgs } from 'react-router'
import { repoLinksResponse } from '../server/repo-links.js'

/** 检查 repo: 链接，在本机打开它指向的文件 */
export async function action({ request }: ActionFunctionArgs) {
  return repoLinksResponse(request)
}
