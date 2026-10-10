/**
 * 页面文字的规则：评论的快照与位置都在这份文字里数。浏览器（取 DOM）与服务端（解析开发服务渲染出的 HTML）各走一遍正文，
 * 两边都按这里判断每个元素怎么算，算出来的文字才一致
 */

/** 页面文字里一个整体元素（图片、SVG、公式等）记成这一个字 */
export const atomicCharacter = '￼'

/** 评论自己放进页面的东西（插进正文的评论数按钮等）都带这个属性 */
export const commentUiAttribute = 'data-comment-ui'

/** 页面正文的容器带这个属性：<DocsBody {...commentScopeProps}> */
export const commentScopeAttribute = 'data-comment-scope'

/** 整个算一个字、里面的东西不算的元素：图片、画布、视频、iframe、SVG 图 */
const atomicTags = new Set(['img', 'svg', 'canvas', 'video', 'iframe'])
/** KaTeX 渲染出的公式：几十层 span，里面的字（还带一份给读屏软件的 MathML）对人没有意义，整个算一个 */
const formulaClass = 'katex'
/** 只给读屏软件看、屏幕上不显示的字（如标题旁「复制这一节的链接」）：不算，换了界面语言快照也不受影响 */
const screenReaderOnlyClass = 'sr-only'

/** 走正文时一个元素怎么算：跳过（连同里面的）、整个算一个字、照常走进去 */
export type PageTextRole = 'skip' | 'atomic' | 'walk'

export function pageTextRoleOf(tagName: string, classNames: readonly string[], isCommentUi: boolean): PageTextRole {
  if (isCommentUi || classNames.includes(screenReaderOnlyClass)) return 'skip'
  if (atomicTags.has(tagName.toLowerCase()) || classNames.includes(formulaClass)) return 'atomic'
  return 'walk'
}
