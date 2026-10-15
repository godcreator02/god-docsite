import type { Route } from './+types/journal'
import { JournalPage } from '@godcreator/collab/site'
import { commentAction, journalLoader } from '@godcreator/collab/site/server'
import { CommentBody } from '@/lib/content'
import { JournalBody } from './journal-body'
import { collabSite } from './site.server'

export const loader = (args: Route.LoaderArgs) => journalLoader(args, collabSite())
export const action = (args: Route.ActionArgs) => commentAction(args, collabSite())

export default function JournalRoute() {
  return <JournalPage JournalBody={JournalBody} CommentBody={CommentBody} />
}
