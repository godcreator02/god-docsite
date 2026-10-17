import { act, type ReactElement } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { createRoutesStub } from 'react-router'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { CommentThread, type PageThreadSummary } from '../src/site/index.js'

const zhou = { id: 'zhou', name: '小周' }
const wang = { id: 'wang', name: '小王' }
const thread: PageThreadSummary = {
  id: '20261012t080000-seed1',
  headPath: '20261012t080000-seed1/index.mdx',
  page: 'tasks',
  author: zhou,
  createdAt: '2026-10-12T08:00:00.000Z',
  reactions: [
    { emoji: '👍', people: [wang, zhou] },
    { emoji: '🎉', people: [wang] },
  ],
  replies: [{ id: '20261012t090000-seed2', path: '20261012t080000-seed1/20261012t090000-seed2.mdx', author: wang, createdAt: '2026-10-12T09:00:00.000Z' }],
}
const Body = () => <p>正文</p>

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

async function renderAt(path: string, element: () => ReactElement) {
  const Stub = createRoutesStub([{ path, Component: element }])
  await act(async () => root.render(<Stub initialEntries={[path]} />))
}

/** jsdom 的选择器认不出属性值里的 emoji，逐个比对 */
function withAttribute<E extends Element = Element>(scope: ParentNode, name: string, value: string): E {
  const found = [...scope.querySelectorAll<E>(`[${name}]`)].find((element) => element.getAttribute(name) === value)
  if (found === undefined) throw new Error(`找不到 ${name}=${value} 的元素`)
  return found
}

const fieldsOfForm = (element: Element) => Object.fromEntries(new FormData(element.closest('form')!) as unknown as Iterable<[string, string]>)

describe('表情回应', () => {
  it('可写：自己点过的高亮、点了撤掉，别人点的点了跟上；提交到调用方给的地址', async () => {
    await renderAt('/tasks', () => <CommentThread thread={thread} action="/comments" writer={zhou} BodyComponent={Body} place="page" />)
    const thumbs = withAttribute(container.querySelector(`[data-reactions-of="${thread.id}"]`)!, 'data-reaction', '👍')
    expect(thumbs.getAttribute('aria-pressed')).toBe('true')
    expect(thumbs.textContent).toBe('👍2')
    expect(thumbs.getAttribute('title')).toContain('小王、小周 点了 👍')
    expect(fieldsOfForm(thumbs)).toEqual({ intent: 'remove-reaction', threadId: thread.id, emoji: '👍' })
    expect(new URL(thumbs.closest('form')!.action).pathname).toBe('/comments')
    const party = withAttribute(container, 'data-reaction', '🎉')
    expect(party.getAttribute('aria-pressed')).toBe('false')
    expect(fieldsOfForm(party)).toEqual({ intent: 'add-reaction', threadId: thread.id, emoji: '🎉' })
    expect(container.querySelector(`[data-reactions-of="${thread.replies[0]!.id}"]`)).toBeNull()
  })

  it('加表情的面板列出能点的 8 个，自己点过的标出来；串头与每条回复各一个按钮', async () => {
    await renderAt('/tasks', () => <CommentThread thread={thread} action="/comments" writer={zhou} BodyComponent={Body} place="page" />)
    expect(container.querySelector(`[data-add-reaction="${thread.replies[0]!.id}"]`)).not.toBeNull()
    await act(async () => container.querySelector<HTMLButtonElement>(`[data-add-reaction="${thread.id}"]`)!.click())
    const options = [...container.querySelectorAll('[data-emoji-option]')]
    expect(options.map((option) => option.textContent)).toEqual(['👍', '👎', '😄', '🎉', '😕', '❤️', '🚀', '👀'])
    expect(options.filter((option) => option.getAttribute('aria-pressed') === 'true').map((option) => option.textContent)).toEqual(['👍'])
  })

  it('只读：回应只显示，没有按钮与加表情', async () => {
    await renderAt('/tasks', () => <CommentThread thread={thread} action="/comments" BodyComponent={Body} place="page" />)
    expect(withAttribute(container, 'data-reaction', '👍').tagName).toBe('SPAN')
    expect(container.querySelectorAll('[data-add-reaction], [data-composer-emoji]')).toHaveLength(0)
  })
})

describe('输入框里的表情', () => {
  it('选中的表情插在光标处，面板收起', async () => {
    await renderAt('/tasks', () => <CommentThread thread={thread} action="/comments" writer={zhou} BodyComponent={Body} place="page" />)
    const textarea = container.querySelector<HTMLTextAreaElement>(`[data-reply-form="${thread.id}"] textarea`)!
    const setValue = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')!.set!
    await act(async () => {
      setValue.call(textarea, '好的谢谢')
      textarea.dispatchEvent(new Event('input', { bubbles: true }))
    })
    textarea.setSelectionRange(2, 2)
    await act(async () => container.querySelector<HTMLButtonElement>(`[data-reply-form="${thread.id}"] [data-composer-emoji]`)!.click())
    await act(async () => withAttribute<HTMLButtonElement>(container, 'data-emoji-option', '🙏').click())
    expect(textarea.value).toBe('好的🙏谢谢')
    expect(container.querySelector('[data-emoji-option]')).toBeNull()
  })
})
