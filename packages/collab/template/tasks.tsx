import type { Route } from './+types/tasks'
import { TasksPage } from '@godcreator/collab/site'
import { recordAction, tasksLoader } from '@godcreator/collab/site/server'
import { CommentBody } from '@/lib/content'
import { collabSite } from './site.server'

export const loader = (args: Route.LoaderArgs) => tasksLoader(args, collabSite())
export const action = (args: Route.ActionArgs) => recordAction(args, collabSite())

export default function TasksRoute() {
  return <TasksPage CommentBody={CommentBody} />
}
