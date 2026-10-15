import type { Route } from './+types/record-links'
import { recordLinksLoader } from '@godcreator/collab/site/server'
import { collabSite } from './site.server'

export const loader = (args: Route.LoaderArgs) => recordLinksLoader(args, collabSite())
