/**
 * 术语标注在 fumadocs-mdx 真实公开输出里的样子：getText('processed')（includeProcessedMarkdown
 * 由官方 Remark LLMs 生成）。不手工序列化 mdast——这里断言的就是站点拿到的实际文本。
 */
import { describe, expect, it } from 'vitest'
import { docs, notes } from '../.source/server'

const entryOf = async (collection: typeof docs | typeof notes, file: string) => {
  const entry = collection.docs.find((item) => item.info.path.replaceAll('\\', '/').endsWith(file))
  if (!entry) throw new Error(`集合里没有 ${file}`)
  return entry
}

describe("getText('processed') 的真实输出", () => {
  it('集合 A：术语原词保留、正文内容不丢（标题/代码/公式/链接的词原样）', async () => {
    const page = await entryOf(docs, 'glossary-demo.mdx')
    const text = await page.getText('processed')
    // 术语词保留（不管 Term 组件被序列化成什么形态，原词必须在）
    expect(text).toContain('命令总线')
    expect(text).toContain('总线')
    expect(text).toContain('panes')
    // 边界处的内容不丢
    expect(text).toContain('标题里的命令总线不标')
    expect(text).toContain('[命令总线](/docs/glossary-demo)')
    // 定义不泄漏进正文文本（那是悬浮框的属性，不是正文）
    expect(text).not.toContain('组件间传命令的一条通道')
  })

  it('集合 B：同样的词在输出里就是普通文字，同样没有任何标注痕迹', async () => {
    const page = await entryOf(notes, 'index.mdx')
    const text = await page.getText('processed')
    expect(text).toContain('命令总线')
    expect(text).not.toContain('<Term')
    expect(text).not.toContain('docsite-term')
  })

  it('集合 A 的输出里 Term 还原为原词：不残留 <Term> 标记，句子连贯', async () => {
    const page = await entryOf(docs, 'glossary-demo.mdx')
    const text = await page.getText('processed')
    // Remark LLMs 对行内 JSX 取 children：实测输出里就是原词，没有标记也没有属性
    expect(text).not.toContain('<Term')
    expect(text).not.toContain('docsite-term')
    expect(text).toContain('正文首现的词才标')
  })
})
