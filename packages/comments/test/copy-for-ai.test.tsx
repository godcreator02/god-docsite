import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { createRoutesStub } from 'react-router'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { CommentThread, type PageThreadSummary } from '../src/site/index.js'
import { threadAiPromptOf } from '../src/site/thread-ai-prompt.js'

const zhou = { id: 'zhou', name: '小周' }
const thread: PageThreadSummary = {
  id: '20261018t010850-ipmb',
  headPath: '20261018t010850-ipmb/index.mdx',
  page: 'code/variant.mdx',
  anchor: 'dc-nnpf84',
  author: zhou,
  createdAt: '2026-10-18T08:08:50.809Z',
  replies: [],
}
const Body = () => <p>正文</p>
const promptInput = {
  siteUrl: 'http://127.0.0.1:41976/',
  threadUrl: 'http://127.0.0.1:41976/code/variant?comment=20261018t010850-ipmb',
  page: 'code/variant.mdx',
  threadId: '20261018t010850-ipmb',
}

describe('评论串复制给 AI 的提示词', () => {
  it('写着站点地址、页面、串 id、打开这一串的链接，以及读串与回复要调的命令', () => {
    const prompt = threadAiPromptOf({ ...promptInput, target: { kind: 'page' } })
    expect(prompt).toContain('站点地址：http://127.0.0.1:41976/')
    expect(prompt).toContain('页面：code/variant.mdx')
    expect(prompt).toContain('评论串：20261018t010850-ipmb')
    expect(prompt).toContain('在网页上打开这一串：http://127.0.0.1:41976/code/variant?comment=20261018t010850-ipmb')
    expect(prompt).toContain('- 批的是：整页')
    expect(prompt).toContain('docsite.comments {"dir": "<站点目录>", "page": "code/variant.mdx"}')
    expect(prompt).toContain('docsite.comment.reply {"dir": "<站点目录>", "thread": "20261018t010850-ipmb"')
  })

  it('批一块时那一块的文字逐行引出来，超过 1500 字截断', () => {
    const prompt = threadAiPromptOf({ ...promptInput, target: { kind: 'element', text: '第一行\n第二行' } })
    expect(prompt).toContain('- 批的是页面上的这一块：\n\n> 第一行\n> 第二行\n\n做法：')
    const long = threadAiPromptOf({ ...promptInput, target: { kind: 'element', text: '字'.repeat(1600) } })
    expect(long).toContain(`> ${'字'.repeat(1500)}…（后面省略）`)
    expect(long).not.toContain('字'.repeat(1501))
  })

  it('划字写原文，原文改过的写明；找不到的写界面上那句说明', () => {
    expect(threadAiPromptOf({ ...promptInput, target: { kind: 'text', quote: '第二段话。', changed: false } })).toContain('- 批的是这段字：\n\n> 第二段话。')
    expect(threadAiPromptOf({ ...promptInput, target: { kind: 'text', quote: '第二段话。', changed: true } })).toContain('批了以后原文改过')
    expect(threadAiPromptOf({ ...promptInput, target: { kind: 'unplaced', note: '批的元素不在这一页上了' } })).toContain('- 批的位置：批的元素不在这一页上了')
  })
})

describe('评论串上的「复制给 AI」', () => {
  let container: HTMLDivElement
  let root: Root
  beforeEach(() => {
    ;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true
    container = document.createElement('div')
    document.body.append(container)
    root = createRoot(container)
  })
  afterEach(() => {
    act(() => root.unmount())
    container.remove()
  })

  async function renderThread(aiPrompt: string | undefined) {
    const Stub = createRoutesStub([{ path: '/code/variant', Component: () => <CommentThread thread={thread} action="/comments" writer={zhou} BodyComponent={Body} place="body" aiPrompt={aiPrompt} /> }])
    await act(async () => root.render(<Stub initialEntries={['/code/variant']} />))
  }

  it('给了提示词：按钮把它写进剪贴板，旁边写明已复制', async () => {
    const copied: string[] = []
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: async (text: string) => void copied.push(text) } })
    await renderThread('这一串的提示词')
    const row = container.querySelector(`[data-thread-ai="${thread.id}"]`)!
    await act(async () => row.querySelector('button')!.click())
    expect(copied).toEqual(['这一串的提示词'])
    expect(row.textContent).toContain('已复制，粘贴给你的 AI')
  })

  it('剪贴板写不进去：把原因显示在按钮旁', async () => {
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: async () => Promise.reject(new Error('页面没有焦点')) } })
    await renderThread('这一串的提示词')
    const row = container.querySelector(`[data-thread-ai="${thread.id}"]`)!
    await act(async () => row.querySelector('button')!.click())
    expect(row.textContent).toContain('没能复制：页面没有焦点')
  })

  it('没给提示词：没有这个按钮', async () => {
    await renderThread(undefined)
    expect(container.querySelector('[data-thread-ai]')).toBeNull()
  })
})
