import { describe, expect, it } from 'vitest'
import { formatCommentBlockSpec, sourceHash } from '../src/comment-source.js'
import { rehypeCommentAnchors } from '../src/vite/comment-anchors.js'

/**
 * 手搭的 hast：结构照 @mdx-js/mdx 编译这些源码时 rehype 插件拿到的样子（段落开头的标记是 mdxJsxTextElement，
 * 单独一行的是 mdxJsxFlowElement，紧凑列表项里没有 p）；位置由 at() 按源码算
 */
type Node = Record<string, unknown> & { children?: Node[] }

function pointAt(source: string, offset: number) {
  const before = source.slice(0, offset).split('\n')
  return { line: before.length, column: before.at(-1)!.length + 1, offset }
}

function makeAt(source: string) {
  return (text: string, from = 0) => {
    const start = source.indexOf(text, from)
    if (start === -1) throw new Error(`源码里没有 ${text}`)
    return { start: pointAt(source, start), end: pointAt(source, start + text.length) }
  }
}

const marker = (type: 'mdxJsxTextElement' | 'mdxJsxFlowElement', id: string, extra: Node[] = []): Node => ({
  type,
  name: 'CommentAnchor',
  attributes: [{ type: 'mdxJsxAttribute', name: 'id', value: id }, ...extra],
  children: [],
})

function run(source: string, tree: Node) {
  rehypeCommentAnchors()(tree as never, { value: source, path: 'page.mdx' })
  return tree
}

function specOf(source: string, placement: 'inline' | 'flow', position: { start: { line: number; column: number; offset: number }; end: { line: number; column: number; offset: number } }) {
  return formatCommentBlockSpec({ placement, start: position.start, end: position.end, hash: sourceHash(source.slice(position.start.offset, position.end.offset)) })
}

describe('评论标记的编译插件', () => {
  it('段落带上源码位置；段落开头的标记拿掉，段落带上标记 id', () => {
    const source = '前面\n\n<CommentAnchor id="a1" />这一段\n'
    const at = makeAt(source)
    const marked = { type: 'element', tagName: 'p', properties: {}, position: at('<CommentAnchor id="a1" />这一段'), children: [marker('mdxJsxTextElement', 'a1'), { type: 'text', value: '这一段' }] }
    const plain = { type: 'element', tagName: 'p', properties: {}, position: at('前面'), children: [{ type: 'text', value: '前面' }] }
    run(source, { type: 'root', children: [plain, { type: 'text', value: '\n' }, marked] })
    expect(plain.properties).toEqual({ dataCommentBlock: specOf(source, 'inline', at('前面')) })
    expect(marked.properties).toEqual({ dataCommentAnchor: 'a1', dataCommentBlock: specOf(source, 'inline', at('<CommentAnchor id="a1" />这一段')) })
    expect(marked.children).toEqual([{ type: 'text', value: '这一段' }])
  })

  it('代码块、组件外面包一层带位置的 div；单独一行的标记拿掉，包的那层带上标记 id；组件里的子组件不包', () => {
    const source = '<CommentAnchor id="c1" />\n```ts\na\n```\n\n<Tabs>\n<Tab>x</Tab>\n</Tabs>\n'
    const at = makeAt(source)
    const pre = { type: 'element', tagName: 'pre', properties: {}, position: at('```ts\na\n```'), children: [] }
    const tab = { type: 'mdxJsxFlowElement', name: 'Tab', attributes: [], position: at('<Tab>x</Tab>'), children: [] }
    const tabs = { type: 'mdxJsxFlowElement', name: 'Tabs', attributes: [], position: at('<Tabs>\n<Tab>x</Tab>\n</Tabs>'), children: [tab] }
    const tree = run(source, { type: 'root', children: [marker('mdxJsxFlowElement', 'c1'), { type: 'text', value: '\n' }, pre, { type: 'text', value: '\n' }, tabs] })
    expect(tree.children).toEqual([
      { type: 'text', value: '\n' },
      { type: 'element', tagName: 'div', properties: { className: ['docsite-comment-block'], dataCommentBlock: specOf(source, 'flow', at('```ts\na\n```')), dataCommentAnchor: 'c1' }, children: [pre] },
      { type: 'text', value: '\n' },
      { type: 'element', tagName: 'div', properties: { className: ['docsite-comment-block'], dataCommentBlock: specOf(source, 'flow', at('<Tabs>\n<Tab>x</Tab>\n</Tabs>')) }, children: [tabs] },
    ])
    expect(tabs.children).toEqual([tab])
  })

  it('紧凑列表项从文字开头算位置；松散列表项不带，由里面的段落带', () => {
    const source = '- 一项\n- 二项\n\n- 三项\n\n  续段\n'
    const at = makeAt(source)
    const tight = { type: 'element', tagName: 'li', properties: {}, position: at('- 一项'), children: [{ type: 'text', value: '一项', position: at('一项') }] }
    const paragraph = { type: 'element', tagName: 'p', properties: {}, position: at('三项'), children: [{ type: 'text', value: '三项' }] }
    const loose = { type: 'element', tagName: 'li', properties: {}, position: at('- 三项\n\n  续段'), children: [{ type: 'text', value: '\n' }, paragraph] }
    run(source, { type: 'root', children: [{ type: 'element', tagName: 'ul', properties: {}, children: [tight, loose] }] })
    expect(tight.properties).toEqual({ dataCommentBlock: formatCommentBlockSpec({ placement: 'inline', start: at('一项').start, end: at('- 一项').end, hash: sourceHash('一项') }) })
    expect(loose.properties).toEqual({})
    expect(paragraph.properties).toEqual({ dataCommentBlock: specOf(source, 'inline', at('三项')) })
  })

  it('标记写错时报错，写明文件与行号', () => {
    const source = '<CommentAnchor id="a1" />\n## 标题\n'
    const at = makeAt(source)
    const heading = { type: 'element', tagName: 'h2', properties: {}, position: at('## 标题'), children: [] }
    expect(() => run(source, { type: 'root', children: [{ ...marker('mdxJsxFlowElement', 'a1'), position: at('<CommentAnchor id="a1" />') }, heading] })).toThrow('page.mdx:1：单独一行的 <CommentAnchor /> 后面要紧跟着段落、代码块、表格或组件')

    const paragraph = (children: Node[]) => ({ type: 'element', tagName: 'p', properties: {}, position: at('<CommentAnchor id="a1" />'), children })
    expect(() => run(source, { type: 'root', children: [paragraph([marker('mdxJsxTextElement', 'a1')]), paragraph([marker('mdxJsxTextElement', 'a1')])] })).toThrow('标记 a1 在这一页出现了两次')
    expect(() => run(source, { type: 'root', children: [paragraph([marker('mdxJsxTextElement', 'a1', [{ type: 'mdxJsxAttribute', name: 'note', value: 'x' }])])] })).toThrow('只写 id，不带别的属性')
    expect(() => run(source, { type: 'root', children: [paragraph([marker('mdxJsxTextElement', 'a1'), marker('mdxJsxTextElement', 'a2')])] })).toThrow('这一块已经有标记 a1')
    expect(() => run(source, { type: 'root', children: [marker('mdxJsxFlowElement', 'a1')] })).toThrow('<CommentAnchor /> 后面要紧跟着它标的那一块')
  })
})
