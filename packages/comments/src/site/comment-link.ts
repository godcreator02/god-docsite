/** 地址里点名要打开的评论串：`?comment=<评论串 id>`，通知里的评论链接就是这样拼的（collab 的 commentDestinationOf） */
export const commentLinkParam = 'comment'

/** 地址的查询串点名的那一串在这一页上就回它的 id；没点名、或点名的串不在这一页，回 null */
export function linkedThreadIdOf(search: string, threadIds: readonly string[]): string | null {
  const threadId = new URLSearchParams(search).get(commentLinkParam)
  return threadId !== null && threadIds.includes(threadId) ? threadId : null
}
