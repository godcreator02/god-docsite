// @vitest-environment jsdom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { createRoutesStub } from 'react-router'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { ProjectHomeData } from '../src/site/index.js'
import { ProjectHome } from '../src/site/index.js'

const people = [
  { id: 'admin', name: '管理员' },
  { id: 'bob', name: '鲍勃', avatar: '/avatars/bob.webp?v=1' },
  { id: 'claude', name: 'Claude', agent: true },
]
const tasks: ProjectHomeData['tasks'] = [
  { id: '20261001090000-mine001', author: 'admin', status: 'doing', title: '鲍勃在做的', owner: 'bob', due: '2026-10-20', module: '20261001090000-mod0001' },
  { id: '20261001090000-mine002', author: 'admin', status: 'done', title: '鲍勃做完的', owner: 'bob' },
  { id: '20261001090000-other01', author: 'admin', status: 'todo', title: '管理员的', owner: 'admin' },
]
const modules: ProjectHomeData['modules'] = [
  { id: '20261001090000-mod0001', author: 'admin', title: '采样板', due: '2099-01-01' },
  { id: '20261001090000-mod0002', author: 'admin', title: '空模块', due: '2099-02-01' },
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

async function renderHome(person: string | null) {
  const identity: ProjectHomeData['identity'] = person === null ? { person: null, reason: '只读：测试' } : { person: people.find((candidate) => candidate.id === person)! }
  const data: ProjectHomeData = { people, person, identity, projectLeads: null, tasks, modules, recentJournalDates: ['2026-10-14', '2026-10-12'] }
  const Stub = createRoutesStub([{ path: '/', Component: () => <ProjectHome siteName="测试项目" docsUrl="/about" data={data} /> }])
  await act(async () => root.render(<Stub initialEntries={['/']} />))
}

const sectionText = (title: string) => [...container.querySelectorAll('section')].find((section) => section.querySelector('h2')?.textContent === title)?.textContent ?? ''
const hrefs = () => [...container.querySelectorAll('a')].map((link) => link.getAttribute('href'))

describe('协作站的项目首页', () => {
  it('有本机身份：只列我没做完的任务；模块列没做完的；最近的日志与成员（不列 agent）', async () => {
    await renderHome('bob')
    expect(container.querySelector('h1')?.textContent).toBe('测试项目')
    expect(container.textContent).toContain('2 个任务没做完 · 2 个模块进行中')
    expect(sectionText('我没做完的任务')).toContain('鲍勃在做的')
    expect(sectionText('我没做完的任务')).not.toContain('鲍勃做完的')
    expect(sectionText('我没做完的任务')).not.toContain('管理员的')
    expect(sectionText('快到期的模块')).toContain('采样板')
    expect(sectionText('快到期的模块')).toContain('0/1')
    expect(sectionText('成员')).toContain('鲍勃')
    expect(sectionText('成员')).not.toContain('Claude')
    // 首页在整站布局之外，自己包着 IdentityProvider：有头像文件的人画图，没有的画首字
    const memberAvatars = [...[...container.querySelectorAll('section')].find((section) => section.querySelector('h2')?.textContent === '成员')!.querySelectorAll('.dc-avatar')]
    expect(memberAvatars.map((avatar) => avatar.getAttribute('src') ?? avatar.textContent)).toEqual(['管', '/avatars/bob.webp?v=1'])
    expect(hrefs()).toEqual(expect.arrayContaining(['/about', '/tasks', '/calendar', '/calendar/2026-10-14', '/tasks/20261001090000-mine001', '/tasks/20261001090000-mod0001']))
  })

  it('只读（没有本机身份）：列全部没做完的任务', async () => {
    await renderHome(null)
    expect(sectionText('没做完的任务')).toContain('鲍勃在做的')
    expect(sectionText('没做完的任务')).toContain('管理员的')
  })
})
