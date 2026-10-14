import { useEffect, useState } from 'react'
import { feedUrlOf } from '../core/feed.js'

/**
 * 推送通道里某个频道的最新值，之后推来新的就跟着变（EventSource 连推送路由，连上先收到现在的值）。
 * initial 是 loader 用 siteFeedValue 读到的值，首屏不用等连接
 */
export function useSiteFeed<Data>(channel: string, initial?: Data): Data | undefined {
  const [data, setData] = useState(initial)
  useEffect(() => {
    const source = new EventSource(feedUrlOf(channel))
    source.addEventListener('message', (event) => setData(JSON.parse(event.data as string) as Data))
    return () => source.close()
  }, [channel])
  return data
}
