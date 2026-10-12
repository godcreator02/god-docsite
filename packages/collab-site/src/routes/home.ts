import { redirect } from 'react-router'

/** 协作站的首页是任务页 */
export function loader() {
  return redirect('/tasks')
}
