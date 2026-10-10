import { formatCommentBlockSpec, sourceHash } from '../comment-source.js'
import { commentAnchorAttribute, commentAnchorComponent, commentAnchorIdPattern, commentBlockAttribute, commentBlockWrapperClass, type CommentBlockSpec } from '../comments.js'

/** 用到的 hast 与 MDX JSX 节点的那几项；基础包不依赖 @types/hast */
type Point = { line: number; column: number; offset?: number }
type HastNode = {
  type: string
  tagName?: string
  name?: string | null
  value?: string
  properties?: Record<string, unknown>
  attributes?: Array<{ type: string; name?: string; value?: unknown }>
  children?: HastNode[]
  position?: { start: Point; end: Point }
}
type CompiledFile = { value: unknown; path?: string }

/** 列表项、段落之外，能整块评论的块：代码块、表格；JSX 组件另判 */
const flowBlockTags = new Set(['pre', 'table'])
/** 列表项里出现这些就不是紧凑列表项的文字开头 */
const nonPhrasingTags = new Set(['p', 'pre', 'table', 'ul', 'ol', 'blockquote', 'div', 'figure', 'hr', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6'])

function isWhitespaceText(node: HastNode) {
  return node.type === 'text' && (node.value ?? '').trim() === ''
}

function isAnchorMarker(node: HastNode) {
  return (node.type === 'mdxJsxTextElement' || node.type === 'mdxJsxFlowElement') && node.name === commentAnchorComponent
}

function isJsxElement(node: HastNode) {
  return node.type === 'mdxJsxTextElement' || node.type === 'mdxJsxFlowElement'
}

/**
 * 编译 MDX 页面时：
 * - 段落、紧凑列表项带上 data-comment-block（标记插在文字开头）；代码块、表格、JSX 组件外面包一层 display: contents 的 div 带上它（标记单独一行插在块前面）。
 *   值是这一块在源文件里的位置与指纹，网页发起评论时传回给评论接口
 * - 源文件里的 <CommentAnchor id="…" /> 拿掉，它标的那一块带上 data-comment-anchor
 *
 * 要排在 fumadocs 的 rehype 插件前面：代码块被 rehypeCode 换成高亮后的节点，原来的位置就没了。
 * 项目的 vite.config.ts 里写 fumadocsMdx({ globalOptions: { mdxOptions: { rehypePlugins: (plugins) => [rehypeCommentAnchors, ...plugins] } } })
 */
export function rehypeCommentAnchors() {
  return (tree: HastNode, file: CompiledFile) => {
    if (typeof file.value !== 'string') throw new Error(`评论标记：拿不到 ${file.path ?? '页面'} 的源码`)
    new AnchorPass(file.value, file.path ?? '页面').visit(tree)
  }
}

class AnchorPass {
  private readonly seenIds = new Set<string>()

  constructor(
    private readonly source: string,
    private readonly file: string,
  ) {}

  private fail(node: HastNode, message: string): never {
    throw new Error(`${this.file}:${node.position?.start.line ?? '?'}：${message}`)
  }

  private specOf(placement: CommentBlockSpec['placement'], start: Point, end: Point) {
    if (start.offset === undefined || end.offset === undefined) throw new Error(`${this.file}:${start.line}：编译出的节点没有字符位置，评论标记没法记源码指纹`)
    return formatCommentBlockSpec({ placement, start, end, hash: sourceHash(this.source.slice(start.offset, end.offset)) })
  }

  private anchorIdOf(marker: HastNode) {
    const attributes = marker.attributes ?? []
    const id = attributes.find((attribute) => attribute.type === 'mdxJsxAttribute' && attribute.name === 'id')?.value
    if (typeof id !== 'string' || !commentAnchorIdPattern.test(id)) this.fail(marker, `<${commentAnchorComponent}> 要写成 <${commentAnchorComponent} id="字母数字" />`)
    if (attributes.length !== 1 || (marker.children ?? []).length > 0) this.fail(marker, `<${commentAnchorComponent}> 只写 id，不带别的属性，也不包内容`)
    if (this.seenIds.has(id)) this.fail(marker, `标记 ${id} 在这一页出现了两次`)
    this.seenIds.add(id)
    return id
  }

  private setAnchor(block: HastNode, id: string, marker: HastNode) {
    block.properties ??= {}
    const existing = block.properties[toPropertyName(commentAnchorAttribute)]
    if (existing !== undefined) this.fail(marker, `这一块已经有标记 ${String(existing)}，同一块只放一个标记，几个评论串共用它`)
    block.properties[toPropertyName(commentAnchorAttribute)] = id
  }

  /** 给能评论的块带上位置；代码块、表格、组件返回包了一层的 div */
  private markBlock(node: HastNode, parent: HastNode): HastNode {
    if (node.type === 'element' && node.tagName === 'p' && node.position) {
      setProperty(node, commentBlockAttribute, this.specOf('inline', node.position.start, node.position.end))
      return node
    }
    if (node.type === 'element' && node.tagName === 'li' && node.position) {
      const first = (node.children ?? []).find((child) => !isWhitespaceText(child))
      const isTight = first !== undefined && first.position !== undefined && !(first.type === 'element' && nonPhrasingTags.has(first.tagName!)) && first.type !== 'mdxJsxFlowElement'
      if (isTight) setProperty(node, commentBlockAttribute, this.specOf('inline', first.position!.start, node.position.end))
      return node
    }
    const isFlowBlock = node.type === 'element' && flowBlockTags.has(node.tagName!)
    // 组件里的子组件（如 Tabs 里的 Tab）不包：父组件可能按子元素的类型取它们
    const isComponentBlock = node.type === 'mdxJsxFlowElement' && !isJsxElement(parent)
    if ((isFlowBlock || isComponentBlock) && node.position) {
      return {
        type: 'element',
        tagName: 'div',
        properties: { className: [commentBlockWrapperClass], [toPropertyName(commentBlockAttribute)]: this.specOf('flow', node.position.start, node.position.end) },
        children: [node],
      }
    }
    return node
  }

  visit(parent: HastNode) {
    const children = parent.children
    if (!children || (parent.type === 'element' && parent.tagName === 'pre')) return
    const kept: HastNode[] = []
    let pendingFlowMarker: { id: string; marker: HastNode } | undefined
    for (const child of children) {
      if (isAnchorMarker(child)) {
        const id = this.anchorIdOf(child)
        if (child.type === 'mdxJsxTextElement') {
          if (!(parent.type === 'element' && (parent.tagName === 'p' || parent.tagName === 'li'))) this.fail(child, `写在文字里的 <${commentAnchorComponent} /> 要放在段落或列表项的开头`)
          this.setAnchor(parent, id, child)
        } else {
          if (pendingFlowMarker) this.fail(child, `两个 <${commentAnchorComponent} /> 连着写了：同一块只放一个标记`)
          pendingFlowMarker = { id, marker: child }
        }
        continue
      }
      if (isWhitespaceText(child)) {
        kept.push(child)
        continue
      }
      this.visit(child)
      const placed = this.markBlock(child, parent)
      if (pendingFlowMarker) {
        const isMarkable = placed.type === 'element' && (placed.tagName === 'p' || hasClass(placed, commentBlockWrapperClass))
        if (!isMarkable) this.fail(pendingFlowMarker.marker, `单独一行的 <${commentAnchorComponent} /> 后面要紧跟着段落、代码块、表格或组件`)
        this.setAnchor(placed, pendingFlowMarker.id, pendingFlowMarker.marker)
        pendingFlowMarker = undefined
      }
      kept.push(placed)
    }
    if (pendingFlowMarker) this.fail(pendingFlowMarker.marker, `<${commentAnchorComponent} /> 后面要紧跟着它标的那一块`)
    parent.children = kept
  }
}

/** data-comment-block → dataCommentBlock：hast 的 properties 用驼峰名 */
function toPropertyName(attribute: string) {
  return attribute.replace(/-([a-z])/g, (_, letter: string) => letter.toUpperCase())
}

function setProperty(node: HastNode, attribute: string, value: string) {
  node.properties ??= {}
  node.properties[toPropertyName(attribute)] = value
}

function hasClass(node: HastNode, className: string) {
  const classes = node.properties?.className
  return Array.isArray(classes) && classes.includes(className)
}
