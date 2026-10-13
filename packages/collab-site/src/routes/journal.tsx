import { use } from 'react'
import { useLoaderData, type ActionFunctionArgs, type LoaderFunctionArgs } from 'react-router'
import { DocsBody, DocsPage } from '@fumadocs/base-ui/layouts/docs/page'
import { journal } from '@site/lib/journal'
import { mdxComponents } from '@site/lib/mdx-components'
import { isRealDate, journalUrlOf } from '../site-data.js'
import { EmptyJournalDay, JournalDayBar, PageTitleWithWideToggle } from '../ui/calendar-page.js'
import { RouteComments } from '../ui/route-comments.js'

type JournalEntry = (typeof journal.entries)[number]

/** /calendar/<日期>：那一天的日志页 journal/<日期>.mdx；还没有日志的日子也能打开，提示让 AI 写。
 *  服务端模块只能在 loader / action 里动态引：模块顶层引的话，客户端懒加载这个路由模块时 vite 直接拒（整页被报错层盖住） */
export async function loader({ params }: LoaderFunctionArgs) {
  const date = params['date']!
  if (!isRealDate(date)) throw new Response(`地址里的日期「${date}」不是 YYYY-MM-DD 的真实日期`, { status: 404 })
  const [{ siteName }, { routeCommentData }] = await Promise.all([import('@site/lib/source.server'), import('../server/comments.server.js')])
  return { date, siteName: siteName(), comments: routeCommentData(journalUrlOf(date)) }
}

export async function action({ request }: ActionFunctionArgs) {
  const { routeCommentsAction } = await import('../server/comments.server.js')
  return routeCommentsAction(request)
}

const entryOf = (date: string) => journal.entries.find((entry) => entry.info.path === `${date}.mdx`)

/** 不用 entry.body：它加载完后不再调用 use()，React 报 conditional use of use() */
function JournalBody({ entry }: { entry: JournalEntry }) {
  const { body: Mdx } = use(entry.load())
  return <Mdx components={mdxComponents} />
}

export default function Journal() {
  const { date, siteName, comments } = useLoaderData<typeof loader>()
  const entry = entryOf(date)
  return (
    <DocsPage>
      <title>{`${date} 的日志 · ${siteName}`}</title>
      <JournalDayBar date={date} />
      <PageTitleWithWideToggle>{date}</PageTitleWithWideToggle>
      <RouteComments page={journalUrlOf(date)} comments={comments}>
        <DocsBody>{entry ? <JournalBody entry={entry} /> : <EmptyJournalDay date={date} />}</DocsBody>
      </RouteComments>
    </DocsPage>
  )
}
