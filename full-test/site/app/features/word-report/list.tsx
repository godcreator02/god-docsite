import type { Route } from './+types/list'
import { ReportListPage } from '@godcreator/word-report/site'
import { reportListLoader } from '@godcreator/word-report/site/server'
import { wordReportSite } from './site.server'

export const loader = (args: Route.LoaderArgs) => reportListLoader(args, wordReportSite())

export default function ReportList() {
  return <ReportListPage />
}
