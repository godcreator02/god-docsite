import { useLoaderData } from 'react-router'
import { DocsPage } from '@fumadocs/base-ui/layouts/docs/page'
import { tasksPageUrl } from '@godcreator/collab-model/task-model'
import { siteName } from '@site/lib/source'
import { TasksPage } from '../ui/tasks-page.js'
import { routeCommentData } from './comment-data.server.js'
import { RouteComments } from './route-comments.js'

export async function loader() {
  return { siteName: siteName(), comments: await routeCommentData(tasksPageUrl) }
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
