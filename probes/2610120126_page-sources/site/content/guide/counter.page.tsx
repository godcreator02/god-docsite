import { useState } from 'react'
import { counterLabel } from './counter-model'

/**
 * TSX 页面：标题、描述、搜索文本与 Markdown 形式都在这份 meta 里明确给出——
 * TSX 的正文要运行组件才知道，搜索只收这里显式提供的文字，不假装它有 MDX 的元数据
 */
export const meta = {
  title: '计数器演示',
  description: 'TSX 互动页面：组件状态、事件与同目录模块引用。',
  searchText: '互动 计数器 点击 次数 状态重置',
  markdown: [
    '# 计数器演示',
    '',
    'TSX 互动页面：组件状态、事件与同目录模块引用。',
    '',
    '## 怎么互动',
    '',
    '点击「加一」计数，点「重置」归零；计数文案来自同目录的 counter-model 模块。',
  ].join('\n'),
}

export default function Page() {
  const [count, setCount] = useState(0)
  return (
    <div className="space-y-4">
      <h2 id="怎么互动">怎么互动</h2>
      <p data-probe="counter-label">{counterLabel(count)}</p>
      <div className="flex gap-2">
        <button
          type="button"
          data-probe="counter-increment"
          onClick={() => setCount((value) => value + 1)}
          className="rounded border px-3 py-1.5"
        >
          加一
        </button>
        <button
          type="button"
          data-probe="counter-reset"
          onClick={() => setCount(0)}
          className="rounded border px-3 py-1.5"
        >
          重置
        </button>
      </div>
      <h3 id="边界说明">边界说明</h3>
      <p>这一页是 React 组件，进站点的组件树：能用状态与事件，也能被外层目录跟踪标题。</p>
    </div>
  )
}
