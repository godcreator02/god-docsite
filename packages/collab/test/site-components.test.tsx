// @vitest-environment jsdom
import { act, type ReactNode } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { createRoutesStub, data, redirect } from 'react-router'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { IdentityProvider } from '@godcreator/identity/site'
import { notificationOf } from '../src/core/notifications/notifications.js'
import type { CollabViewer, RecordLinkTargets, RecordPageData, TasksPageData, WriteResult } from '../src/site/index.js'
import { CollabViewerProvider, NotificationBar, RecordLink, RecordView, TasksView } from '../src/site/index.js'

const people = [
  { id: 'admin', name: '管理员' },
  { id: 'bob', name: '鲍勃' },
]
const viewer = { people, person: 'bob', projectLeads: null }
const task = { id: '20261001090000-aaaaaaa', author: 'admin', status: 'todo' as const, title: '画采样板' }
/** 站点上协作页都在整站布局里：布局给 IdentityProvider（头像按它查），页面自己给 CollabViewerProvider */
function PageProviders({ viewer: pageViewer, children }: { viewer: CollabViewer; children: ReactNode }) {
  return (
    <IdentityProvider identity={{ person: people[1]! }} people={pageViewer.people}>
      <CollabViewerProvider viewer={pageViewer}>{children}</CollabViewerProvider>
    </IdentityProvider>
  )
}
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
    const pageData: RecordPageData = { siteName: '站', ...viewer, record: { kind: 'task', task }, modules: [], groups: [], pages: [], mentions: [], comments: noComments }
    const Stub = createRoutesStub([
      {
        path: '/tasks/:recordId',
        Component: () => (
          <PageProviders viewer={pageData}>
            <RecordView data={pageData} action={`/tasks/${task.id}`} />
          </PageProviders>
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
    const pageData: TasksPageData = { siteName: '站', ...viewer, tasks: [], modules: [], groups: [], pages: [], comments: noComments }
    const Stub = createRoutesStub([
      {
        path: '/tasks',
        Component: () => (
          <PageProviders viewer={pageData}>
            <TasksView data={pageData} action="/tasks" />
          </PageProviders>
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

describe('按分组画多张甘特图', () => {
  const groups = [
    { id: 'sst', title: 'SST' },
    { id: 'mmc', title: 'MMC' },
  ]
  const modules = [
    { id: '20261001080000-aaaaaaa', author: 'admin', title: '主控板', due: '2026-12-01', group: 'mmc' },
    { id: '20261001080001-bbbbbbb', author: 'admin', title: '采样板', due: '2026-11-01', group: 'sst' },
    { id: '20261001080002-ccccccc', author: 'admin', title: '机架', due: '2026-10-20' },
  ]

  async function renderTasks(pageData: TasksPageData) {
    const Stub = createRoutesStub([
      {
        path: '/tasks',
        Component: () => (
          <PageProviders viewer={pageData}>
            <TasksView data={pageData} action="/tasks" />
          </PageProviders>
        ),
      },
    ])
    await act(async () => root.render(<Stub initialEntries={['/tasks']} />))
  }

  it('一组一张图，照分组列表的先后，没写分组的在最后「未分组」', async () => {
    await renderTasks({ siteName: '站', ...viewer, tasks: [], modules, groups, pages: [], comments: noComments })
    const charts = [...container.querySelectorAll('[data-module-group]')].map((chart) => [chart.querySelector('h3')!.textContent, chart.querySelector('button[title="只看这个模块的任务"]')!.textContent])
    expect(charts).toEqual([
      ['SST', expect.stringContaining('采样板')],
      ['MMC', expect.stringContaining('主控板')],
      ['未分组', expect.stringContaining('机架')],
    ])
  })

  it('有分组时新建模块要先选一组或「不分组」才能提交；表单里的 group 是选中那一组的 id，选「不分组」就没有 group', async () => {
    await renderTasks({ siteName: '站', ...viewer, tasks: [], modules, groups, pages: [], comments: noComments })
    const form = () => container.querySelector('form')!
    const submit = () => [...container.querySelectorAll<HTMLButtonElement>('button[type="submit"]')].find((button) => button.textContent === '新建模块')!
    const groupSelect = () => container.querySelector<HTMLSelectElement>('select[aria-label="分组"]')!
    await act(async () => [...container.querySelectorAll('button')].find((button) => button.textContent === '新建模块')!.click())
    await act(async () => changeValue(container.querySelector<HTMLInputElement>('input[aria-label="标题"]')!, '驱动板'))
    await act(async () => changeValue(form().querySelector<HTMLInputElement>('input[name="due"]')!, '2026-12-20'))
    expect(submit().disabled).toBe(true)
    await act(async () => changeValue(groupSelect(), 'mmc'))
    expect(submit().disabled).toBe(false)
    expect(Object.fromEntries(new FormData(form()))).toEqual({ intent: 'create-record', type: 'module', title: '驱动板', group: 'mmc', due: '2026-12-20' })
    await act(async () => changeValue(groupSelect(), '-'))
    expect(submit().disabled).toBe(false)
    expect(Object.fromEntries(new FormData(form()))).toEqual({ intent: 'create-record', type: 'module', title: '驱动板', due: '2026-12-20' })
  })
})

describe('任务看板的两层筛选', () => {
  const module = { id: '20261001080000-mmmmmmm', author: 'admin', title: '采样', due: '2026-12-01' }
  const tasks = [
    { id: '20261001090000-aaaaaaa', author: 'admin', status: 'todo' as const, title: '鲍勃在模块里', owner: 'bob', module: module.id },
    { id: '20261001090001-bbbbbbb', author: 'admin', status: 'todo' as const, title: '鲍勃没归模块', owner: 'bob' },
    { id: '20261001090002-ccccccc', author: 'admin', status: 'doing' as const, title: '管理员在模块里', owner: 'admin', module: module.id },
  ]
  const pageData: TasksPageData = { siteName: '站', ...viewer, tasks, modules: [module], groups: [], pages: [], comments: noComments }

  const boardTitles = () => [...container.querySelectorAll('section li a')].map((link) => link.textContent).sort()
  const filterNote = () => container.querySelector('[data-board-filter-note]')?.textContent ?? ''
  const activeChip = () => container.querySelector('[aria-label="看板显示哪些任务"] button[aria-pressed="true"]')?.textContent ?? ''
  const click = (selector: string, text?: string) =>
    act(async () => [...container.querySelectorAll<HTMLButtonElement>(selector)].find((button) => text === undefined || button.textContent?.includes(text))!.click())

  async function renderTasks() {
    const Stub = createRoutesStub([
      {
        path: '/tasks',
        Component: () => (
          <PageProviders viewer={pageData}>
            <TasksView data={pageData} action="/tasks" />
          </PageProviders>
        ),
      },
    ])
    await act(async () => root.render(<Stub initialEntries={['/tasks']} />))
  }

  it('先点人再点模块：说明写出人和模块，选中的那个筛选的计数等于看板上的张数', async () => {
    await renderTasks()
    await click('button[title="只看 鲍勃 的任务"]')
    expect(filterNote()).toContain('只看 鲍勃 的任务')
    expect(activeChip()).toBe('全部2')
    await click('button[title="只看这个模块的任务"]', '采样')
    expect(boardTitles()).toEqual(['鲍勃在模块里'])
    expect(filterNote()).toContain('只看 鲍勃 在模块「采样」里的任务')
    expect(activeChip()).toBe('采样1')
  })

  it('只点模块不点人：说明只写模块，计数按全部人算', async () => {
    await renderTasks()
    await click('button[title="只看这个模块的任务"]', '采样')
    expect(boardTitles()).toEqual(['管理员在模块里', '鲍勃在模块里'])
    expect(filterNote()).toContain('只看模块「采样」里的任务')
    expect(activeChip()).toBe('采样2')
    await click('[data-board-filter-note] button', '采样')
    expect(filterNote()).toBe('')
    expect(boardTitles()).toHaveLength(3)
  })
})

describe('通知栏', () => {
  it('通知与人员都由调用方传入：人名换成显示名；没有通知时不显示', async () => {
    const mention = notificationOf({ kind: 'mention', comment: 't/index.mdx', author: 'admin', page: '/tasks?comment=t', text: '@bob 看看', in: 'comment' })
    const Stub = createRoutesStub([{ path: '/', Component: () => <NotificationBar notifications={[mention]} aiPrompt={null} people={people} /> }])
    await act(async () => root.render(<Stub initialEntries={['/']} />))
    await act(async () => container.querySelector<HTMLButtonElement>('button[aria-expanded]')!.click())
    expect(container.textContent).toContain('管理员 在评论里 @了我')
    expect(container.textContent).not.toContain('复制给 AI')
    const Empty = createRoutesStub([{ path: '/', Component: () => <NotificationBar notifications={null} aiPrompt={null} people={people} /> }])
    await act(async () => root.render(<Empty initialEntries={['/']} />))
    expect(container.textContent).toBe('')
  })

  it('有提示词时「复制给 AI」把它写进剪贴板，并写明复制了几件事', async () => {
    const copied: string[] = []
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: async (text: string) => void copied.push(text) } })
    const mention = notificationOf({ kind: 'mention', comment: 't/index.mdx', author: 'admin', page: '/tasks?comment=t', text: '@bob 看看', in: 'comment' })
    const Stub = createRoutesStub([{ path: '/', Component: () => <NotificationBar notifications={[mention]} aiPrompt="交给 AI 的提示词" people={people} /> }])
    await act(async () => root.render(<Stub initialEntries={['/']} />))
    await act(async () => container.querySelector<HTMLButtonElement>('button[aria-expanded]')!.click())
    const copyButton = [...container.querySelectorAll('button')].find((button) => button.textContent === '复制给 AI')!
    await act(async () => copyButton.click())
    expect(copied).toEqual(['交给 AI 的提示词'])
    expect(container.textContent).toContain('已复制 1 件事，粘贴给你的 AI')
  })
})

describe('通知栏的一键提交', () => {
  const unsubmitted = notificationOf({ kind: 'unsubmitted', records: ['records/a.json'], siteFiles: [] })
  const conflicts = notificationOf({ kind: 'conflicts', files: ['site/content/a.mdx'] })

  async function renderBar(notifications: Parameters<typeof NotificationBar>[0]['notifications'], submit: Parameters<typeof NotificationBar>[0]['submit']) {
    const Stub = createRoutesStub([{ path: '/', Component: () => <NotificationBar notifications={notifications} aiPrompt="提示词" people={people} submit={submit} /> }])
    await act(async () => root.render(<Stub initialEntries={['/']} />))
    const toggle = container.querySelector<HTMLButtonElement>('button[aria-expanded]')
    if (toggle !== null) await act(async () => toggle.click())
  }
  const submitButton = () => container.querySelector<HTMLButtonElement>('[data-submit-button]')

  it('有没提交审核的改动才出现，提交到任务页的 action；站点没接一键提交就没有按钮', async () => {
    await renderBar([unsubmitted], null)
    expect(submitButton()!.disabled).toBe(false)
    expect(submitButton()!.textContent).toBe('一键提交')
    const form = submitButton()!.closest('form')!
    expect(new URL(form.action).pathname).toBe('/tasks')
    expect(new FormData(form).get('intent')).toBe('request-submit')
    await renderBar([unsubmitted], undefined)
    expect(submitButton()).toBeNull()
    await renderBar([notificationOf({ kind: 'mention', comment: 't/index.mdx', author: 'admin', page: '/tasks?comment=t', text: '@bob 看看', in: 'comment' })], null)
    expect(submitButton()).toBeNull()
  })

  it('有冲突时不能点，写明先处理什么；正在提交时不能点，收起的提示栏上写着进度', async () => {
    await renderBar([unsubmitted, conflicts], null)
    expect(submitButton()!.disabled).toBe(true)
    expect(container.textContent).toContain('先处理：合 main 的冲突还没改好')
    await renderBar([unsubmitted], { state: 'running', by: 'bob', at: new Date().toISOString() })
    expect(submitButton()!.disabled).toBe(true)
    expect(submitButton()!.textContent).toBe('提交中…')
    expect(container.querySelector('button[aria-expanded]')!.textContent).toContain('正在提交审核…')
  })

  it('没有通知时：正在提交、刚合并的显示一条状态，合并得久了就不显示', async () => {
    await renderBar([], { state: 'requested', by: 'bob', at: new Date().toISOString() })
    expect(container.querySelector('[role="status"]')!.textContent).toBe('等工作台接手提交…')
    await renderBar([], { state: 'merged', by: 'bob', at: new Date().toISOString(), pull: { number: 12, url: 'https://git.test/pulls/12' } })
    expect(container.querySelector('[role="status"]')!.textContent).toBe('已提交审核并合并 #12')
    await renderBar([], { state: 'merged', by: 'bob', at: '2026-01-01T00:00:00.000Z', pull: { number: 12, url: 'https://git.test/pulls/12' } })
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
