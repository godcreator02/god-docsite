import { useLoaderData, type ActionFunctionArgs } from 'react-router'
import { DocsPage } from '@fumadocs/base-ui/layouts/docs/page'
import { tasksPageUrl } from '@godcreator/collab-model/task-model'
import { siteName } from '@site/lib/source.server'
import { routeCommentData, routeCommentsAction } from '../server/comments.js'
import { TasksPage } from '../ui/tasks-page.js'
import { RouteComments } from '../ui/route-comments.js'

export function loader() {
  return { siteName: siteName(), comments: routeCommentData(tasksPageUrl) }
}

export function action({ request }: ActionFunctionArgs) {
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
