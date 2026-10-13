import { useLoaderData, type ActionFunctionArgs, type LoaderFunctionArgs } from 'react-router'
import { DocsPage } from '@fumadocs/base-ui/layouts/docs/page'
import { recordPageUrlOf } from '@godcreator/collab-model/task-model'
import { RecordPage, useRecordTitle } from '../ui/record-page.js'
import { RouteComments } from '../ui/route-comments.js'

/** 一条任务或一个模块那一页；「日志里的进展」要读日志页的原文，在这里读。
 *  服务端模块只能在 loader / action 里动态引：模块顶层引的话，客户端懒加载这个路由模块时 vite 直接拒（整页被报错层盖住） */
export async function loader({ params }: LoaderFunctionArgs) {
  const recordId = params['recordId']!
  const [{ siteName }, { recordJournalMentions }, { routeCommentData }] = await Promise.all([
    import('@site/lib/source.server'),
    import('../server/index.server.js'),
    import('../server/comments.server.js'),
  ])
  return { recordId, mentions: await recordJournalMentions(recordId), siteName: siteName(), comments: routeCommentData(recordPageUrlOf(recordId)) }
}

export async function action({ request }: ActionFunctionArgs) {
  const { routeCommentsAction } = await import('../server/comments.server.js')
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
