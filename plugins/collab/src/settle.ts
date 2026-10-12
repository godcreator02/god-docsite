/**
 * 文件接连变化时停下 settleMilliseconds 没有新变化才做：保存、提交、取回都会连着改好几个文件。
 * 按 key 分开等；work 出错交给 onError：这里在定时器里，抛出去没有调用方接，会让整个 gwb 崩溃
 */
export type Settler = { later(key: string, work: () => void): void; cancel(key: string): void; close(): void }

export function settlerOf(settleMilliseconds: number, onError: (key: string, error: unknown) => void): Settler {
  const timers = new Map<string, ReturnType<typeof setTimeout>>()
  return {
    later(key, work) {
      clearTimeout(timers.get(key))
      timers.set(
        key,
        setTimeout(() => {
          timers.delete(key)
          try {
            work()
          } catch (error) {
            onError(key, error)
          }
        }, settleMilliseconds),
      )
    },
    cancel(key) {
      clearTimeout(timers.get(key))
      timers.delete(key)
    },
    close() {
      for (const timer of timers.values()) clearTimeout(timer)
      timers.clear()
    },
  }
}
