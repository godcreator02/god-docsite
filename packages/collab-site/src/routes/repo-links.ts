import type { ActionFunctionArgs } from 'react-router'

/** 检查 repo: 链接，在本机打开它指向的文件。
 *  服务端模块只能在 action 里动态引：模块顶层引的话，客户端懒加载这个路由模块时 vite 直接拒 */
export async function action({ request }: ActionFunctionArgs) {
  const { repoLinksResponse } = await import('../server/repo-links.server.js')
  return repoLinksResponse(request)
}
