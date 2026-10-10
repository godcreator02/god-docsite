/// <reference types="vite/client" />
import { useEffect, useState } from 'react'
import { feedEndpointPrefix, feedEvent, type FeedMessage } from '../site-feed.js'

/**
 * 推送通道里某个频道最新的一份，之后推来新的就跟着变。开发服务里先向开发服务取一次，再听 Vite 的 WebSocket；
 * 发布出去的站没有推送，一直是 undefined
 */
export function useSiteFeed<Data>(channel: string): Data | undefined {
  const [data, setData] = useState<Data>()
  useEffect(() => {
    const hot = import.meta.hot
    if (!hot) return
    let current = true
    void fetch(`${feedEndpointPrefix}/${channel}`)
      .then(async (response) => {
        if (!response.ok) throw new Error(`取推送 ${channel} 失败：${await response.text()}`)
        return (await response.json()) as Data | null
      })
      .then((latest) => {
        if (current && latest !== null) setData(latest)
      })
    const listener = (message: FeedMessage) => {
      if (message.channel === channel) setData(message.data as Data)
    }
    hot.on(feedEvent, listener)
    return () => {
      current = false
      hot.off(feedEvent, listener)
    }
  }, [channel])
  return data
}
