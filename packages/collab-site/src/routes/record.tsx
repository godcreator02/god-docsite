import { useLoaderData, type ActionFunctionArgs, type LoaderFunctionArgs } from 'react-router'
import { DocsPage } from '@fumadocs/base-ui/layouts/docs/page'
import { recordPageUrlOf } from '@godcreator/collab-model/task-model'
import { siteName } from '@site/lib/source.server'
import { recordJournalMentions } from '../server/index.js'
import { routeCommentData, routeCommentsAction } from '../server/comments.js'
import { RecordPage, useRecordTitle } from '../ui/record-page.js'
import { RouteComments } from '../ui/route-comments.js'

/** 一条任务或一个模块那一页；「日志里的进展」要读日志页的原文，在这里读 */
export async function loader({ params }: LoaderFunctionArgs) {
  const recordId = params['recordId']!
  return { recordId, mentions: await recordJournalMentions(recordId), siteName: siteName(), comments: routeCommentData(recordPageUrlOf(recordId)) }
}

export function action({ request }: ActionFunctionArgs) {
  return routeCommentsAction(request)
}

export default function Record() {
  const { recordId, mentions, siteName, comments } = useLoaderData<typeof loader>()
  const title = useRecordTitle(recordId) ?? '找不到的任务'
  return (
    <DocsPage>
      <title>{`${title} · ${siteName}`}</title>
      <RouteComments page={recordPageUrlOf(recordId)} comments={comments}>
        <RecordPage recordId={recordId} mentions={mentions} />
      </RouteComments>
    </DocsPage>
  )
}
