import { act, type ReactElement } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { createRoutesStub } from 'react-router'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { CommentThread, type PageThreadSummary } from '../src/site/index.js'
import { CommentsInbox } from '../src/site/comments-inbox.js'

const writer = { id: 'zhou', name: '小周' }
const thread: PageThreadSummary = {
  id: '20261012t080000-seed1',
  headPath: '20261012t080000-seed1/index.mdx',
  page: 'tasks',
  author: writer,
  createdAt: '2026-10-12T08:00:00.000Z',
  replies: [{ id: '20261012t090000-seed2', path: '20261012t080000-seed1/20261012t090000-seed2.mdx', author: writer, createdAt: '2026-10-12T09:00:00.000Z' }],
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

const pathnameOf = (selector: string) => new URL(container.querySelector(selector)!.closest('form')!.action).pathname

describe('评论表单的提交地址由调用方给', () => {
  it('一串评论：页面在 /tasks，回复、删串、删回复都提交到调用方给的 /comments，不是当前页也不是 /', async () => {
    await renderAt('/tasks', () => <CommentThread thread={thread} action="/comments" writer={writer} BodyComponent={Body} place="page" />)
    expect(pathnameOf(`[data-reply-form="${thread.id}"] textarea`)).toBe('/comments')
    expect(pathnameOf(`[data-delete-thread="${thread.id}"]`)).toBe('/comments')
    expect(pathnameOf(`[data-delete-reply="${thread.replies[0]!.id}"]`)).toBe('/comments')
  })

  it('收件箱：批整页的输入框提交到 /comments，带上调用方给的页面', async () => {
    await renderAt('/tasks', () => (
      <CommentsInbox
        items={[{ thread, place: 'page' }]}
        pagePath="tasks"
        action="/comments"
        access={{ kind: 'writable', writer }}
        BodyComponent={Body}
        openThreadId={null}
        onOpenThread={() => {}}
        onClose={() => {}}
        onThreadCreated={() => {}}
      />
    ))
    const form = container.querySelector<HTMLFormElement>('[data-new-thread-form]')!
    expect(new URL(form.action).pathname).toBe('/comments')
    expect(new FormData(form).get('page')).toBe('tasks')
    expect(new FormData(form).get('intent')).toBe('create-thread')
  })

  it('只读：没有回复框与删除按钮，收件箱写明原因、没有输入框', async () => {
    await renderAt('/tasks', () => (
      <>
        <CommentThread thread={thread} action="/comments" BodyComponent={Body} place="page" />
        <CommentsInbox
          items={[{ thread, place: 'page' }]}
          pagePath="tasks"
          action="/comments"
          access={{ kind: 'readonly', reasonCode: 'readonly', reasonText: '只读：这是发布版' }}
          BodyComponent={Body}
          openThreadId={null}
          onOpenThread={() => {}}
          onClose={() => {}}
          onThreadCreated={() => {}}
        />
      </>
    ))
    expect(container.querySelectorAll('[data-reply-form], [data-delete-thread], [data-delete-reply], [data-new-thread-form]')).toHaveLength(0)
    expect(container.querySelector('[data-readonly-reason]')?.textContent).toContain('只读：这是发布版')
  })
})

describe('一串评论的状态按钮', () => {
  const intentOfToggle = () => container.querySelector('[data-thread-status-toggle]')!.closest('form')!.querySelector<HTMLInputElement>('input[name="intent"]')!.value

  it('未解决的串是「标为已解决」，已解决的是「重新打开」；只读时没有按钮', async () => {
    await renderAt('/tasks', () => <CommentThread thread={thread} action="/comments" writer={writer} BodyComponent={Body} place="page" />)
    expect(container.querySelector('[data-comment-card]')!.getAttribute('data-thread-status')).toBe('open')
    expect(container.querySelector('[data-thread-status-toggle]')!.getAttribute('aria-label')).toBe('标为已解决')
    expect(intentOfToggle()).toBe('resolve-thread')
    expect(pathnameOf('[data-thread-status-toggle]')).toBe('/comments')

    const resolved: PageThreadSummary = { ...thread, resolved: { by: writer, at: '2026-10-15T08:00:00.000Z' } }
    await renderAt('/tasks', () => <CommentThread thread={resolved} action="/comments" writer={writer} BodyComponent={Body} place="page" />)
    expect(container.querySelector('[data-comment-card]')!.getAttribute('data-thread-status')).toBe('resolved')
    expect(container.querySelector('[data-thread-status-toggle]')!.getAttribute('aria-label')).toBe('重新打开')
    expect(intentOfToggle()).toBe('reopen-thread')

    await renderAt('/tasks', () => <CommentThread thread={thread} action="/comments" BodyComponent={Body} place="page" />)
    expect(container.querySelector('[data-thread-status-toggle]')).toBeNull()
  })
})
