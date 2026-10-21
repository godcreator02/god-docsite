import { Children, createContext, isValidElement, useContext, type ReactNode } from 'react'
import { ImageZoom } from './image-zoom.js'

/** Figure 在 FigureRow 里：等宽并排，忽略自己的 width */
const InFigureRowContext = createContext(false)

export type FigureProps = {
  /** 图片地址；外部页里写相对 mdx 文件的路径，编译时改写成功能包文件路由的地址 */
  src: string
  /** 占正文宽度的百分比，10–100，缺省 100；在 FigureRow 里忽略 */
  width?: number
  /** 图注，可以含公式 */
  children?: ReactNode
}

function assertFigureProps({ src, width }: FigureProps): void {
  if (typeof src !== 'string' || src === '') throw new Error(`Figure：缺少 src 属性（图片地址，字符串），现在是 ${JSON.stringify(src)}`)
  if (width !== undefined && (typeof width !== 'number' || !(width >= 10 && width <= 100))) {
    throw new Error(`Figure：width 属性要是 10 到 100 的数字（占正文宽度的百分比，写成 width={60}），现在是 ${JSON.stringify(width)}`)
  }
}

/** 一张图加图注；图片点了能放大 */
export function Figure(props: FigureProps) {
  assertFigureProps(props)
  const inFigureRow = useContext(InFigureRowContext)
  const { src, width, children } = props
  return (
    <figure
      data-figure=""
      className={`not-prose flex flex-col items-center gap-2 ${inFigureRow ? 'min-w-0 flex-1' : 'mx-auto my-6'}`}
      style={inFigureRow ? undefined : { width: `${width ?? 100}%` }}
    >
      <div className="w-full rounded-xl border border-fd-border bg-fd-card p-2">
        <ImageZoom src={src} alt={typeof children === 'string' ? children : ''} className="mx-auto h-auto max-w-full" />
      </div>
      {children === undefined ? null : <figcaption className="text-center text-sm text-fd-muted-foreground">{children}</figcaption>}
    </figure>
  )
}

export type FigureRowProps = {
  /** 总图注，纯文字；含公式的总图注改用 FigureRow 里最后的 FigureRowCaption；几张各自带图注的独立图并排时不写 */
  caption?: string
  /** 放 Figure，最后可以再放一个 FigureRowCaption */
  children?: ReactNode
}

/** FigureRow 的总图注，可以含公式；只能是 FigureRow 里最后一个子元素，由 FigureRow 渲出来 */
export function FigureRowCaption(_props: { children?: ReactNode }): never {
  throw new Error('FigureRowCaption：只能放在 FigureRow 里，作为最后一个子元素')
}

/** MDX 在标签之间留下的空白文字不算子元素 */
function isBlankText(child: ReactNode): boolean {
  return typeof child === 'string' && child.trim() === ''
}

const nameOfChild = (child: ReactNode): string =>
  isValidElement(child) ? (typeof child.type === 'string' ? `<${child.type}>` : '别的组件') : `文字 ${JSON.stringify(String(child))}`

/** 子元素拆成并排的 Figure 与末尾的 FigureRowCaption（没有就是 null） */
function partsOf(children: ReactNode): { figures: ReactNode[]; captionContent: ReactNode | null } {
  const items = Children.toArray(children).filter((child) => !isBlankText(child))
  const last = items.at(-1)
  const hasCaptionChild = isValidElement(last) && last.type === FigureRowCaption
  const figures = hasCaptionChild ? items.slice(0, -1) : items
  for (const child of figures) {
    if (isValidElement(child) && child.type === FigureRowCaption) throw new Error('FigureRow：FigureRowCaption 只能放在最后，而且只能有一个')
    if (!isValidElement(child) || child.type !== Figure) throw new Error(`FigureRow：子元素只能放 Figure（最后可以再放一个 FigureRowCaption），这里放了${nameOfChild(child)}`)
  }
  if (figures.length === 0) throw new Error('FigureRow：里面至少放一个 Figure')
  return { figures, captionContent: hasCaptionChild ? (last.props as { children?: ReactNode }).children : null }
}

/** 几张图等宽并排，容器宽度不够时改成上下排；总图注是 caption 或末尾的 FigureRowCaption */
export function FigureRow({ caption, children }: FigureRowProps) {
  if (caption !== undefined && typeof caption !== 'string') throw new Error(`FigureRow：caption 属性要是纯文字（字符串），现在是 ${typeof caption}；含公式的总图注写成最后一个子元素 <FigureRowCaption>`)
  const { figures, captionContent } = partsOf(children)
  if (caption !== undefined && captionContent !== null) throw new Error('FigureRow：caption 属性与 FigureRowCaption 只能给一个')
  const captionShown = captionContent ?? caption
  return (
    <figure data-figure-row="" className="not-prose @container my-6 flex flex-col gap-2">
      <InFigureRowContext value={true}>
        <div className="flex flex-col gap-4 @md:flex-row @md:items-start">{figures}</div>
      </InFigureRowContext>
      {captionShown === undefined ? null : <figcaption className="text-center text-sm text-fd-muted-foreground">{captionShown}</figcaption>}
    </figure>
  )
}
