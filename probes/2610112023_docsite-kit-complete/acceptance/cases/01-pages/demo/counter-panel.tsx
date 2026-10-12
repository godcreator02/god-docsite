import { useEffect, useState } from 'react'

// 交互验收的最小组件：计数器、受控输入框。
// hydrated 标记在客户端脚本接管后才变成 yes，用来区分「只有服务端渲染的静态页」和「交互真的有效」。
export function CounterPanel({ start = 0 }: { start?: number }) {
  const [count, setCount] = useState(start)
  const [draft, setDraft] = useState('')
  const [hydrated, setHydrated] = useState(false)
  useEffect(() => setHydrated(true), [])
  return (
    <div>
      <p data-hydrated={hydrated ? 'yes' : 'no'}>
        计数：<span data-testid="count">{count}</span>{' '}
        <button type="button" onClick={() => setCount((c) => c + 1)}>
          加一
        </button>
      </p>
      <p>
        <label>
          未保存输入
          <input data-testid="draft" value={draft} onChange={(e) => setDraft(e.target.value)} />
        </label>
      </p>
      <p>已输入：{draft === '' ? '（空）' : draft}</p>
    </div>
  )
}
