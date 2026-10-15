import type { Route } from './+types/note'
import { createNotePage } from 'e2e-demo/site'
import { noteLoader } from 'e2e-demo/site/server'
import browserCollections from '../../../.source/browser'
import { demoSite } from './site.server'

export const loader = (args: Route.LoaderArgs) => noteLoader(args, demoSite)
export default createNotePage(browserCollections.e2eDemoNotes)
