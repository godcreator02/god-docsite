import type { Route } from './+types/report'
import { ReportDocumentPage } from '@godcreator/word-report/site'
import { reportPageLoader } from '@godcreator/word-report/site/server'
import { commentAvatar, CommentBody } from '@/lib/content'
import { wordReportSite } from './site.server'

export const loader = (args: Route.LoaderArgs) => reportPageLoader(args, wordReportSite())

/** 评论写进站点的评论写入路由 /comments（comments 功能），和内容页一样 */
export default function Report() {
  return <ReportDocumentPage commentAction="/comments" CommentBody={CommentBody} AvatarComponent={commentAvatar} />
}
