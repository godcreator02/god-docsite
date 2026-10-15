import type { Route } from './+types/record'
import { RecordPage } from '@godcreator/collab/site'
import { recordAction, recordLoader } from '@godcreator/collab/site/server'
import { CommentBody } from '@/lib/content'
import { collabSite } from './site.server'

export const loader = (args: Route.LoaderArgs) => recordLoader(args, collabSite())
export const action = (args: Route.ActionArgs) => recordAction(args, collabSite())

export default function RecordRoute() {
  return <RecordPage CommentBody={CommentBody} />
}
