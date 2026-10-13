import type { LoaderFunctionArgs } from 'react-router'

/** repo: 链接指向的 PDF、图片、网页、视频交给浏览器。
 *  服务端模块只能在 loader 里动态引：模块顶层引的话，客户端懒加载这个路由模块时 vite 直接拒 */
export async function loader({ params }: LoaderFunctionArgs) {
  const { projectFileResponse } = await import('../server/repo-links.server.js')
  return projectFileResponse(params['*'] ?? '')
}
