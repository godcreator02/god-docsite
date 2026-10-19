import { useEffect, useState } from 'react'
import { siteFeedClient } from './feed-client.js'

/**
 * 推送通道里某个频道的最新值，之后推来新的就跟着变。一页的全部频道合用一条事件流、页面隐藏时断开（见 createSiteFeedClient），连上先收到现在的值。
 * initial 是 loader 用 siteFeedValue 读到的值，首屏不用等连接
 */
export function useSiteFeed<Data>(channel: string, initial?: Data): Data | undefined {
  const [data, setData] = useState(initial)
  useEffect(() => siteFeedClient().subscribe(channel, (value) => setData(value as Data)), [channel])
  return data
}
