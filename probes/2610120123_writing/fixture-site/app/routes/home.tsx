import { Link } from 'react-router'

const samples = [
  { to: '/docs', text: '集合 A（content/docs）：启用术语插件的正文与全部写作组件样本' },
  { to: '/docs/glossary-demo', text: '术语标注的边界样本：代码、链接、标题、公式里的词不标' },
  { to: '/notes', text: '集合 B（content/notes）：同样的词，不启用术语插件' },
  { to: '/tex', text: 'TSX 公式页：<Tex> 行内与块级' },
]

export default function Home() {
  return (
    <main className="mx-auto max-w-2xl p-8">
      <h1 className="text-2xl font-semibold">写作能力样本站</h1>
      <ul className="mt-6 space-y-3">
        {samples.map((sample) => (
          <li key={sample.to}>
            <Link className="text-fd-primary underline" to={sample.to}>
              {sample.text}
            </Link>
          </li>
        ))}
      </ul>
    </main>
  )
}
