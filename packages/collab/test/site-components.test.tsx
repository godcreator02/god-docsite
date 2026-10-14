// @vitest-environment jsdom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { createRoutesStub, data, redirect } from 'react-router'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { notificationOf } from '../src/core/notifications/notifications.js'
import type { RecordLinkTargets, RecordPageData, TasksPageData, WriteResult } from '../src/site/index.js'
import { CollabViewerProvider, NotificationBar, RecordLink, RecordView, TasksView } from '../src/site/index.js'

const people = [
  { id: 'admin', name: '管理员' },
  { id: 'bob', name: '鲍勃' },
]
const viewer = { people, person: 'bob', projectLeads: null }
const task = { id: '20261001090000-aaaaaaa', author: 'admin', status: 'todo' as const, title: '画采样板' }
const noComments = { threads: [], access: { kind: 'readonly' as const, reasonCode: 'readonly', reasonText: '只读' } }

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

/** 等异步的提交、跳转、加载走完：按条件等，最多 2 秒 */
async function waitFor(condition: () => boolean) {
  for (let elapsed = 0; elapsed < 2000 && !condition(); elapsed += 10) {
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 10))
    })
  }
  expect(condition()).toBe(true)
}

/** 把表单控件的值改掉并发出 change：React 认的是原生 setter 设的值 */
function changeValue(element: HTMLInputElement | HTMLSelectElement, value: string) {
  const prototype = element instanceof HTMLSelectElement ? HTMLSelectElement.prototype : HTMLInputElement.prototype
  Object.getOwnPropertyDescriptor(prototype, 'value')!.set!.call(element, value)
  element.dispatchEvent(new Event(element instanceof HTMLSelectElement ? 'change' : 'input', { bubbles: true }))
}

describe('记录那一页改字段走 useFetcher 提交到调用方给的地址', () => {
  it('改状态：提交 update-record 到 /tasks/<id>；被写入规则拒绝时原话显示在那个字段下面', async () => {
    const received: Array<Record<string, FormDataEntryValue>> = []
    const pageData: RecordPageData = { siteName: '站', ...viewer, record: { kind: 'task', task }, modules: [], pages: [], mentions: [], comments: noComments }
    const Stub = createRoutesStub([
      {
        path: '/tasks/:recordId',
        Component: () => (
          <CollabViewerProvider viewer={pageData}>
            <RecordView data={pageData} action={`/tasks/${task.id}`} />
          </CollabViewerProvider>
        ),
        action: async ({ request }) => {
          received.push(Object.fromEntries(await request.formData()))
          return data<WriteResult>({ ok: false, error: '状态被规则挡住了' }, { status: 422 })
        },
      },
    ])
    await act(async () => root.render(<Stub initialEntries={[`/tasks/${task.id}`]} />))
    const status = container.querySelector<HTMLSelectElement>('select[aria-label="状态"]')!
    await act(async () => changeValue(status, 'doing'))
    await waitFor(() => container.textContent!.includes('状态被规则挡住了'))
    expect(received).toEqual([{ intent: 'update-record', id: task.id, field: 'status', value: 'doing' }])
  })
})

describe('任务页新建任务', () => {
  it('提交 create-record 到调用方给的地址，action 跳转后到了新记录那一页', async () => {
    const received: Array<Record<string, FormDataEntryValue>> = []
    const pageData: TasksPageData = { siteName: '站', ...viewer, tasks: [], modules: [], pages: [], comments: noComments }
    const Stub = createRoutesStub([
      {
        path: '/tasks',
        Component: () => (
          <CollabViewerProvider viewer={pageData}>
            <TasksView data={pageData} action="/tasks" />
          </CollabViewerProvider>
        ),
        action: async ({ request }) => {
          received.push(Object.fromEntries(await request.formData()))
          return redirect('/tasks/20261014120000-nnnnnnn')
        },
      },
      { path: '/tasks/:recordId', Component: () => <p>新记录那一页</p> },
    ])
    await act(async () => root.render(<Stub initialEntries={['/tasks']} />))
    const newTask = [...container.querySelectorAll('button')].find((button) => button.textContent === '新建任务')!
    await act(async () => newTask.click())
    await act(async () => changeValue(container.querySelector<HTMLInputElement>('input[aria-label="标题"]')!, '  调 PLL  '))
    const submit = [...container.querySelectorAll<HTMLButtonElement>('button[type="submit"]')].find((button) => button.textContent === '新建任务')!
    await act(async () => submit.click())
    await waitFor(() => container.textContent!.includes('新记录那一页'))
    expect(received).toEqual([{ intent: 'create-record', type: 'task', status: 'todo', title: '调 PLL' }])
  })
})

describe('通知栏', () => {
  it('通知与人员都由调用方传入：人名换成显示名；没有通知时不显示', async () => {
    const mention = notificationOf({ kind: 'mention', comment: 't/index.mdx', author: 'admin', page: '/tasks?comment=t', text: '@bob 看看', in: 'comment' })
    const Stub = createRoutesStub([{ path: '/', Component: () => <NotificationBar notifications={[mention]} people={people} /> }])
    await act(async () => root.render(<Stub initialEntries={['/']} />))
    await act(async () => container.querySelector<HTMLButtonElement>('button[aria-expanded]')!.click())
    expect(container.textContent).toContain('管理员 在评论里 @了我')
    const Empty = createRoutesStub([{ path: '/', Component: () => <NotificationBar notifications={null} people={people} /> }])
    await act(async () => root.render(<Empty initialEntries={['/']} />))
    expect(container.textContent).toBe('')
  })
})

describe('正文里的记录链接', () => {
  it('经资源路由取记录当前的标题；删掉的记录写「已删除的记录」', async () => {
    const asked: string[] = []
    const targets: RecordLinkTargets = { records: [{ kind: 'task', id: task.id, title: '画采样板', status: 'doing', module: null }], journalDates: [] }
    const Stub = createRoutesStub([
      {
        path: '/notes',
        Component: () => (
          <p>
            <RecordLink id={task.id} /> 与 <RecordLink id="20261001090000-zzzzzzz" />
          </p>
        ),
      },
      {
        path: '/api/record-links',
        loader: ({ request }) => {
          asked.push(new URL(request.url).searchParams.getAll('id').join(','))
          return targets
        },
      },
    ])
    await act(async () => root.render(<Stub initialEntries={['/notes']} />))
    await waitFor(() => container.textContent!.includes('画采样板') && container.textContent!.includes('已删除的记录'))
    expect(asked.sort()).toEqual(['20261001090000-zzzzzzz', task.id].sort())
  })
})
