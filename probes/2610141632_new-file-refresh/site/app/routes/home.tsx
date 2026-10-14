import { Link } from 'react-router'

export default function Home() {
  return (
    <main className="p-8 flex flex-col gap-2">
      <Link to="/docs">正文</Link>
      <Link to="/journal">日志</Link>
    </main>
  )
}
