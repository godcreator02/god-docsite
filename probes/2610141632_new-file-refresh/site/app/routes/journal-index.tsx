import { Link } from 'react-router'
import { journal } from '../lib/journal'

const dateOf = (filePath: string) => filePath.replace(/\.mdx$/, '')

export default function JournalIndex() {
  const dates = journal.entries.map((entry) => dateOf(entry.info.path)).sort()
  return (
    <main className="p-8">
      <h1>日志</h1>
      <ul>
        {dates.map((date) => (
          <li key={date}>
            <Link to={`/journal/${date}`}>{date}</Link>
          </li>
        ))}
      </ul>
    </main>
  )
}
