import type { Route } from './+types/asset'
import { reportAssetLoader } from '@godcreator/word-report/site/server'
import { wordReportSite } from './site.server'

export const loader = (args: Route.LoaderArgs) => reportAssetLoader(args, wordReportSite())
