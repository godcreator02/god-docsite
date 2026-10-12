import { use } from 'react'
import { useLoaderData, type LoaderFunctionArgs } from 'react-router'
import { DocsBody, DocsPage } from '@fumadocs/base-ui/layouts/docs/page'
import { PageTitleWithWideToggle } from '@godcreator/docsite-kit/ui'
import { journal } from '@site/lib/journal'
import { mdxComponents } from '@site/lib/mdx-components'
import { siteName } from '@site/lib/source'
import { isRealDate, journalUrlOf } from '../site-data.js'
import { EmptyJournalDay, JournalDayBar } from '../ui/calendar-page.js'
import { routeCommentData } from './comment-data.server.js'
import { RouteComments } from './route-comments.js'

type JournalEntry = (typeof journal.entries)[number]

/** /calendar/<日期>：那一天的日志页 journal/<日期>.mdx；还没有日志的日子也能打开，提示让 AI 写 */
export async function loader({ params }: LoaderFunctionArgs) {
  const date = params['date']!
  if (!isRealDate(date)) throw new Response(`地址里的日期「${date}」不是 YYYY-MM-DD 的真实日期`, { status: 404 })
  return { date, siteName: siteName(), comments: await routeCommentData(journalUrlOf(date)) }
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
