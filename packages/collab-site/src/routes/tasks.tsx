import { useLoaderData, type ActionFunctionArgs } from 'react-router'
import { DocsPage } from '@fumadocs/base-ui/layouts/docs/page'
import { tasksPageUrl } from '@godcreator/collab-model/task-model'
import { TasksPage } from '../ui/tasks-page.js'
import { RouteComments } from '../ui/route-comments.js'

/** 服务端模块只能在 loader / action 里动态引：模块顶层引的话，客户端懒加载这个路由模块时 vite 直接拒（整页被报错层盖住） */
export async function loader() {
  const [{ siteName }, { routeCommentData }] = await Promise.all([import('@site/lib/source.server'), import('../server/comments.server.js')])
  return { siteName: siteName(), comments: routeCommentData(tasksPageUrl) }
}

export async function action({ request }: ActionFunctionArgs) {
  const { routeCommentsAction } = await import('../server/comments.server.js')
  return routeCommentsAction(request)
}

export default function Tasks() {
  const { siteName, comments } = useLoaderData<typeof loader>()
  return (
    <DocsPage full>
      <title>{`任务 · ${siteName}`}</title>
      <RouteComments page={tasksPageUrl} comments={comments}>
        <TasksPage />
      </RouteComments>
    </DocsPage>
  )
}
