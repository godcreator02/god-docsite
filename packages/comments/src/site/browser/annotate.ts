/**
 * 可批元素的标注走查（按块批注的认定协议）：
 * 骨架把正文容器标上 data-comment-scope（见 ./page-text），这里在浏览器里遍历它，
 * 给候选块级元素标 data-comment-target，没有 id 的按内容指纹分配稳定 id
 * （标题沿用正文编译时已有的 id，目录链接靠它）。走查只加属性、不产生文字节点，
 * 页面文字（./page-text）不受影响；同一份内容每次走查结果相同。
 *
 * 候选协议：标题、段落、列表项、代码块、引用块、表格、图片、figure、公式（.katex）、SVG，
 * 加上任何元素显式声明的 data-comment-target（组件包想让整个组件可批就这么写）。
 * id 的稳定口径：内容指纹（标签 + 图片地址或文字）随内容变，内容不变它就不变；
 * 同页内容相同的元素按出现次序加 -2、-3 后缀——在它前面插入一份相同内容会让后缀错位，
 * 这是协议里已知的边界。布局用的 div 不是候选，点它批不到。
 *
 * 不在任何候选块里的可点元素与媒体（导航小标签这类单放的链接、按钮、展开标题、表单控件、canvas、视频、嵌入内容）
 * 也能批，批的是它本身；段落里的链接照旧批整段。它们的 id 用单独的指纹口径（前缀 dc-s-、单独计序号），
 * 不改变候选元素已经分到的 id，已有评论的落点不受影响。
 */

/** 候选块级元素带这个属性；组件想让自己整个可批也直接声明它 */
export const commentTargetAttribute = 'data-comment-target'

const candidateSelector = 'h1,h2,h3,h4,h5,h6,p,li,pre,blockquote,table,img,figure,figcaption,svg,.katex,[data-comment-target]'
const standaloneSelector = 'a,button,[role="button"],summary,input,select,textarea,canvas,video,iframe'

/** 不在任何候选块里的可点元素或媒体：往上找到的第一个；在候选块里就不算 */
function standaloneTargetOf(element: Element): HTMLElement | null {
  const standalone = element.closest<HTMLElement>(standaloneSelector)
  return standalone && standalone.closest(candidateSelector) === null ? standalone : null
}

/** 批注模式里点正文，拾取的是离点击处最近的一个候选元素（往上找）；没有候选块就是单放的可点元素或媒体本身，都没有就没有目标 */
export function commentTargetNear(node: Node, scope: Element): HTMLElement | null {
  const element = node instanceof Element ? node : node.parentElement
  const target = element ? (element.closest<HTMLElement>(candidateSelector) ?? standaloneTargetOf(element)) : null
  if (!target || !scope.contains(target)) return null
  return target
}

function signatureOf(element: Element): string {
  if (element instanceof HTMLImageElement && element.getAttribute('src')) return `src:${element.getAttribute('src')}`
  const text = element.textContent ?? ''
  if (text !== '') return `text:${text}`
  // 内容为空又显式声明了可批（占位外壳这类）：用整段 HTML 当指纹，class 变了它会跟着变
  return element.hasAttribute(commentTargetAttribute) ? `html:${element.outerHTML}` : ''
}

function fingerprint(text: string): string {
  let hash = 0x811c9dc5
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i)
    hash = Math.imul(hash, 0x01000193)
  }
  return (hash >>> 0).toString(36)
}

/**
 * 给正文里的候选元素补 data-comment-target 与 id。已带的属性不重写（走查反复跑也不产生
 * DOM 变更），元素已有的 id（标题这些）一律保留
 */
export function annotateCommentTargets(scope: Element): void {
  const seen = new Map<string, number>()
  for (const element of scope.querySelectorAll<HTMLElement>(candidateSelector)) {
    const signature = signatureOf(element)
    if (signature === '') continue
    const base = `dc-${fingerprint(signature)}`
    const occurrence = (seen.get(base) ?? 0) + 1
    seen.set(base, occurrence)
    if (element.id === '') element.id = occurrence === 1 ? base : `${base}-${occurrence}`
    if (!element.hasAttribute(commentTargetAttribute)) element.setAttribute(commentTargetAttribute, '')
  }
  annotateStandaloneTargets(scope)
}

/** 单放的可点元素与媒体的指纹：标签加地址或文字；canvas 这类没有文字的只有标签，同页几个按次序加后缀 */
function standaloneSignatureOf(element: HTMLElement): string {
  const source = element.getAttribute('src') ?? element.getAttribute('href') ?? ''
  return `${element.tagName.toLowerCase()}:${source}:${(element.textContent ?? '').trim()}`
}

/**
 * 给单放的可点元素与媒体补 id（不标 data-comment-target：标了就成了候选，下一轮候选走查的序号会被它们打乱）。
 * 已有 id 的不改
 */
function annotateStandaloneTargets(scope: Element): void {
  const seen = new Map<string, number>()
  for (const element of scope.querySelectorAll<HTMLElement>(standaloneSelector)) {
    if (element.closest(candidateSelector) !== null) continue
    const base = `dc-s-${fingerprint(standaloneSignatureOf(element))}`
    const occurrence = (seen.get(base) ?? 0) + 1
    seen.set(base, occurrence)
    if (element.id === '') element.id = occurrence === 1 ? base : `${base}-${occurrence}`
  }
}

const kindNames: Array<[string, string]> = [
  ['img', '图片'],
  ['svg', '图片'],
  ['canvas', '图片'],
  ['video', '视频'],
  ['iframe', '嵌入内容'],
  ['pre', '代码块'],
  ['table', '表格'],
  ['blockquote', '引用'],
]

const labelQuoteLength = 24

/** 元素写给人看的文字：跳过只给读屏软件看的字（如标题旁「复制这一节的链接」） */
function visibleTextOf(element: Element): string {
  let text = ''
  const walk = (parent: Node) => {
    for (const child of parent.childNodes) {
      if (child.nodeType === Node.TEXT_NODE) text += (child as Text).data
      else if (child.nodeType === Node.ELEMENT_NODE && !(child as Element).classList.contains('sr-only')) walk(child)
    }
  }
  walk(element)
  return text
}

/** 拾取到的元素写给人看：「代码块「pnpm install…」」「图片」 */
export function commentTargetLabelOf(element: Element): string {
  if (element.classList.contains('katex')) return '公式'
  for (const [tag, name] of kindNames) if (element.tagName.toLowerCase() === tag) return name
  if (element.querySelector('pre')) return '代码块'
  if (element.querySelector('table')) return '表格'
  const text = visibleTextOf(element).replace(/\s+/g, ' ').trim()
  if (text === '') return element.tagName.toLowerCase() === 'img' ? '图片' : '元素'
  return `「${text.slice(0, labelQuoteLength)}${text.length > labelQuoteLength ? '…' : ''}」`
}
