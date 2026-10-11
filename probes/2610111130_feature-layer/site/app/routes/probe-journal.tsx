import { use } from 'react'
import { probeJournal } from '../lib/probe-journal'
import type { Route } from './+types/probe-journal'

type JournalEntry = (typeof probeJournal.entries)[number]

export function loader({ params }: Route.LoaderArgs) {
  return { date: params.date, dates: probeJournal.entries.map((entry) => entry.info.path) }
}

function JournalBody({ entry }: { entry: JournalEntry }) {
  const { body: Mdx } = use(entry.load())
  return <Mdx />
}

export default function ProbeJournal({ loaderData }: Route.ComponentProps) {
  const { date, dates } = loaderData
  const entry = probeJournal.entries.find((candidate) => candidate.info.path === `${date}.mdx`)
  return (
    <div id="probe-journal">
      <p>第二个集合文件里的日志：{dates.join('、')}</p>
      {entry ? <JournalBody entry={entry} /> : <p>没有 {date} 的日志</p>}
    </div>
  )
}
