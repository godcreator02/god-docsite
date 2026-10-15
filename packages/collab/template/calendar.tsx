import type { Route } from './+types/calendar'
import { calendarLoader } from '@godcreator/collab/site/server'
import { collabSite } from './site.server'

export const loader = (args: Route.LoaderArgs) => calendarLoader(args, collabSite())
export { CalendarPage as default } from '@godcreator/collab/site'
