import { use } from 'react'
import { journal } from '../lib/journal'
import type { Route } from './+types/journal-page'

type JournalEntry = (typeof journal.entries)[number]

const entryOf = (date: string) => journal.entries.find((entry) => entry.info.path === `${date}.mdx`)

// 实验用：日志不存在回 404，测量「新日志页能打开」有明确的判据（协作站真实页面对没有日志的日子显示空白日）
export async function loader({ params }: Route.LoaderArgs) {
  const entry = entryOf(params.date)
  if (!entry) throw new Response('没有这一天的日志', { status: 404 })
  return { date: params.date, title: String(entry.title) }
}

function JournalBody({ entry }: { entry: JournalEntry }) {
  const { body: Mdx } = use(entry.load())
  return <Mdx />
}

export default function JournalPage({ loaderData }: Route.ComponentProps) {
  const entry = entryOf(loaderData.date)
  return (
    <main className="p-8">
      <h1>{loaderData.title}</h1>
      {entry ? <JournalBody entry={entry} /> : null}
    </main>
  )
}
