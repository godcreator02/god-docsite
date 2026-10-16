import { useState } from 'react'
import { ImageZoom } from '@godcreator/god-docsite/react'
import { Tex } from '@godcreator/god-docsite/tex'
import zoomLarge from './tsx-demo/zoom-large.svg'
import zoomSmall from './tsx-demo/zoom-small.svg'

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
      <ImageZoom src={zoomSmall} zoomSrc={zoomLarge} alt="点了放大的示意图" width={240} height={120} data-tsx-zoom-image="" />
    </div>
  )
}
