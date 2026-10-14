import { useState } from 'react'
import { Tex } from '@godcreator/god-docsite/tex'

export const meta = { title: 'TSX 演示页', description: '用 TSX 写的页面', searchText: '计数器演示' }

export default function TsxDemo() {
  const [count, setCount] = useState(0)
  return (
    <div>
      <h2 id="counter">计数器</h2>
      <button type="button" data-tsx-counter="" onClick={() => setCount(count + 1)}>
        {count}
      </button>
      <p>
        公式：<Tex>{String.raw`a^2 + b^2 = c^2`}</Tex>
      </p>
    </div>
  )
}
