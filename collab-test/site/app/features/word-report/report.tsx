import type { Route } from './+types/report'
import { ReportDocumentPage } from '@godcreator/word-report/site'
import { reportPageLoader } from '@godcreator/word-report/site/server'
import { wordReportSite } from './site.server'

export const loader = (args: Route.LoaderArgs) => reportPageLoader(args, wordReportSite())

export default function Report() {
  return <ReportDocumentPage />
}
