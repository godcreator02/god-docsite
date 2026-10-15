import type { Route } from './+types/project-file'
import { projectFileLoader } from '@godcreator/collab/site/server'
import { collabSite } from './site.server'

export const loader = (args: Route.LoaderArgs) => projectFileLoader(args, collabSite())
