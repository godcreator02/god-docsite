import { useState } from 'react'
import { DynamicCodeBlock } from '@fumadocs/base-ui/components/dynamic-codeblock'

export const meta = { title: 'TSX 页面', description: '这一页本身就是一个 TSX 页面：导出 meta 与默认组件，组件里能用 React 的状态' }

const sourceLines = [
  "import { useState } from 'react'",
  '',
  "export const meta = { title: 'TSX 页面', description: '……' }",
  '',
  'export default function Page() {',
  '  const [count, setCount] = useState(0)',
  '  return <button onClick={() => setCount((current) => current + 1)}>点了 {count} 次</button>',
  '}',
]

export default function Page() {
  const [count, setCount] = useState(0)
  return (
    <>
      <p>
        这一页的文件是 <code>content/(kit)/page-types/tsx-page.page.tsx</code>。下面的按钮由页面自己的状态驱动，点了次数会变：
      </p>
      <p>
        <button type="button" onClick={() => setCount((current) => current + 1)} className="rounded-md border px-3 py-1.5 text-sm hover:bg-fd-accent">
          点了 {count} 次
        </button>
      </p>
      <p>文件的写法（TSX 页面里放代码用 fumadocs 的 DynamicCodeBlock，和 MDX 里的代码块一样着色）：</p>
      <DynamicCodeBlock lang="tsx" code={sourceLines.join('\n')} codeblock={{ title: 'tsx-page.page.tsx' }} />
    </>
  )
}
