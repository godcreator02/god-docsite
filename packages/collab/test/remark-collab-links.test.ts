import remarkMdx from 'remark-mdx'
import remarkParse from 'remark-parse'
import { unified } from 'unified'
import { describe, expect, it } from 'vitest'
import { remarkCollabLinks } from '../src/site/links/remark-collab-links.js'

type Node = { type: string; name?: string; url?: string; value?: string; attributes?: Array<{ name: string; value: string }>; children?: Node[] }

function paragraphOf(markdown: string): Node[] {
  const processor = unified().use(remarkParse).use(remarkMdx).use(remarkCollabLinks)
  const tree = processor.runSync(processor.parse(markdown)) as unknown as Node
  return tree.children![0]!.children!
}

const elementOf = (node: Node) => ({ type: node.type, name: node.name, attributes: node.attributes?.map(({ name, value }) => [name, value]), text: node.children?.map((child) => child.value).join('') })

describe('正文里的协作链接换成组件', () => {
  it('任务与模块、日志页、repo: 链接换成 RecordLink、JournalLink、RepoLink，链接文字留作内容', () => {
    const nodes = paragraphOf('见 [](/tasks/20261001090000-aaaaaaa)、[那天](/calendar/2026-10-10) 与 [原理图](repo:hw/sch.pdf#page=2)')
    expect(nodes.filter((node) => node.type !== 'text').map(elementOf)).toEqual([
      { type: 'mdxJsxTextElement', name: 'RecordLink', attributes: [['id', '20261001090000-aaaaaaa']], text: '' },
      { type: 'mdxJsxTextElement', name: 'JournalLink', attributes: [['date', '2026-10-10']], text: '那天' },
      { type: 'mdxJsxTextElement', name: 'RepoLink', attributes: [['href', 'repo:hw/sch.pdf#page=2']], text: '原理图' },
    ])
  })

  it('别的链接、不是真实日期的日历地址、任务页下更深的地址原样留着', () => {
    const nodes = paragraphOf('[a](/notes) [b](/calendar/2026-02-30) [c](/tasks/x/y) [d](https://example.org)')
    expect(nodes.filter((node) => node.type !== 'text').map((node) => [node.type, node.url])).toEqual([
      ['link', '/notes'],
      ['link', '/calendar/2026-02-30'],
      ['link', '/tasks/x/y'],
      ['link', 'https://example.org'],
    ])
  })
})
