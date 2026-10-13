import type { ActionFunctionArgs } from 'react-router'

/** 新建、修改、删除任务与模块：只改协作仓 collab/records/ 里的文件。
 *  服务端模块只能在 action 里动态引：模块顶层引的话，客户端懒加载这个路由模块时 vite 直接拒 */
export async function action({ request }: ActionFunctionArgs) {
  const { collabRecordResponse } = await import('../server/index.server.js')
  return collabRecordResponse(request)
}
