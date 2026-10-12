/** 评论链接协议：评论包只定「去一串评论批的那一页」的地址怎么写，站点的通用链接组件按它解析 */
export const linkedCommentParam = 'comment'

/** 去一串评论批的那一页：地址带上 ?comment=<评论串>，那一页找好位置后打开它 */
export function commentLinkOf(page: string, thread: string) {
  return `${page}?${new URLSearchParams({ [linkedCommentParam]: thread })}`
}
