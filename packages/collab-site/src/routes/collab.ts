import type { ActionFunctionArgs } from 'react-router'
import { collabRecordResponse } from '../server/index.server.js'

/** 新建、修改、删除任务与模块：只改协作仓 collab/records/ 里的文件 */
export async function action({ request }: ActionFunctionArgs) {
  return collabRecordResponse(request)
}
