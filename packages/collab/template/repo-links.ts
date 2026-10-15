import type { Route } from './+types/repo-links'
import { repoLinkAction, repoLinksLoader } from '@godcreator/collab/site/server'
import { collabSite } from './site.server'

export const loader = (args: Route.LoaderArgs) => repoLinksLoader(args, collabSite())
export const action = (args: Route.ActionArgs) => repoLinkAction(args, collabSite())
