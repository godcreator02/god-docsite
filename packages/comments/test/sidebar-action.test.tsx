import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { createRoutesStub } from 'react-router'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { CommentsSidebar, type PageThreadSummary } from '../src/site/index.js'

const threads: PageThreadSummary[] = [
  {
    id: '20261012t080000-seed1',
    headPath: '20261012t080000-seed1/index.mdx',
    page: 'tasks',
    author: { id: 'zhou', name: '小周' },
    createdAt: '2026-10-12T08:00:00.000Z',
    replies: [],
  },
]

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

describe('评论面板的提交地址由调用方给', () => {
  it('页面在 /tasks，表单提交到调用方给的 /comments，不是当前页也不是 /', async () => {
    const Stub = createRoutesStub([
      {
        path: '/tasks',
        Component: () => (
          <CommentsSidebar
            pagePath="tasks"
            action="/comments"
            threads={threads}
            access={{ kind: 'writable', writer: { id: 'zhou', name: '小周' } }}
            BodyComponent={() => <p>正文</p>}
          />
        ),
      },
    ])
    await act(async () => root.render(<Stub initialEntries={['/tasks']} />))
    const deleteForm = container.querySelector('[data-delete-thread]')!.closest('form')!
    expect(new URL(deleteForm.action).pathname).toBe('/comments')
    act(() => container.querySelector<HTMLButtonElement>('[data-new-thread-toggle]')!.click())
    expect(new URL(container.querySelector<HTMLFormElement>('[data-new-thread-form]')!.action).pathname).toBe('/comments')
  })
})
