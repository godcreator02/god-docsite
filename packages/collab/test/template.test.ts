import { existsSync, readdirSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it, vi } from 'vitest'
import { calendarUrl, journalDirName, journalFileGlob, journalUrlOf, projectFileApiUrl, recordLinksApiUrl, recordPageUrlOf, repoLinksApiUrl, tasksPageUrl } from '../src/core/index.js'
import { notificationOf } from '../src/core/notifications/notifications.js'
import { InvalidSiteFeed } from '../src/core/notifications/site-feed.js'
import { remarkCollabLinks } from '../src/mdx/index.js'
import { importsOf, importsOfFile, reachableFrom } from './source-imports.js'

// 平台的浏览器出口连带加载 @fumadocs/base-ui 的样式文件，Node 里 import 不了；这里只测不渲染的导出
vi.mock('@godcreator/god-docsite/react', () => ({ useSiteFeed: () => undefined }))

/*
 * 功能包模板：建站器把 template/ 原样复制到站点的 app/features/collab/。
 * 模板文件的类型检查在 test/template-site/tsconfig.json（pnpm typecheck 里跑）
 */

const templateDir = path.resolve(import.meta.dirname, '../template')
const templateFile = (name: string) => path.join(templateDir, name)
const templateText = (name: string) => readFileSync(templateFile(name), 'utf8')

const pageRoutes = ['tasks.tsx', 'record.tsx', 'calendar.tsx', 'journal.tsx']
const resourceRoutes = ['record-links.ts', 'repo-links.ts', 'project-file.ts']
const routesWithAction = ['tasks.tsx', 'record.tsx', 'journal.tsx', 'repo-links.ts']

describe('功能包模板的文件', () => {
  it('文件齐全，没有多出来的：路由表、转发文件、日志正文、运行时、站点信息、构建期、样式', () => {
    expect(readdirSync(templateDir).sort()).toEqual(
      ['routes.ts', ...pageRoutes, ...resourceRoutes, 'journal-body.tsx', 'feature.tsx', 'site.server.ts', 'mdx.ts', 'styles.css'].sort(),
    )
  })

  it('routes.ts 能 import：地址与本包的地址常量一致，转发文件都在模板目录里', async () => {
    const { default: routes } = await import('../template/routes.ts')
    const expected: Array<[string, string]> = [
      [tasksPageUrl, 'tasks.tsx'],
      [recordPageUrlOf(':recordId'), 'record.tsx'],
      [calendarUrl, 'calendar.tsx'],
      [journalUrlOf(':date'), 'journal.tsx'],
      [recordLinksApiUrl, 'record-links.ts'],
      [repoLinksApiUrl, 'repo-links.ts'],
      [`${projectFileApiUrl}*`, 'project-file.ts'],
    ]
    expect(routes.map((route) => [`/${route.path}`, path.relative(templateDir, route.file)])).toEqual(expected)
    expect(routes.filter((route) => !existsSync(route.file))).toEqual([])
  })

  it('转发文件：都有 loader；页面路由有页面组件，资源路由没有；写入走路由 action', () => {
    const exportsOf = (name: string) => {
      const text = templateText(name)
      return {
        loader: /^export const loader = /m.test(text),
        action: /^export const action = /m.test(text),
        component: /^export default function |^export \{ \w+ as default \}/m.test(text),
      }
    }
    for (const name of [...pageRoutes, ...resourceRoutes]) {
      expect(exportsOf(name), name).toEqual({ loader: true, action: routesWithAction.includes(name), component: pageRoutes.includes(name) })
    }
  })

  it('站点信息每次请求现组装：转发文件里不在模块顶层调 collabSite()', () => {
    for (const name of [...pageRoutes, ...resourceRoutes]) {
      const topLevelCalls = templateText(name)
        .split('\n')
        .filter((line) => line.includes('collabSite()') && !/^export const (loader|action) = \(args: Route\.\w+Args\) => /.test(line))
      expect(topLevelCalls, name).toEqual([])
    }
  })
})

describe('mdx.ts（构建期，只经 source.config.ts 加载）', () => {
  it('不 import react：只用 fumadocs-mdx 的配置与本包的 core、./mdx 出口，这两个出口走到的文件也不碰 react', () => {
    expect(importsOfFile(templateFile('mdx.ts')).sort()).toEqual(['@godcreator/collab', '@godcreator/collab/mdx', 'fumadocs-mdx/config'])
    const reached = [...reachableFrom('core/index.ts'), ...reachableFrom('mdx/index.ts')]
    const outside = reached.flatMap((name) => importsOf(name).filter((spec) => !spec.startsWith('.')).map((spec) => `${name} → ${spec}`))
    expect(outside.filter((line) => /→ (react|react-dom|react-router|lucide-react|@fumadocs\/|fumadocs-)/.test(line))).toEqual([])
  })

  it('给站点集合的 remark 插件是记录链接；日志集合照本包的日志规则：journal/ 顶层的 <日期>.mdx，正文按需加载', async () => {
    const mdx = await import('../template/mdx.ts')
    expect(mdx.remarkPlugins).toEqual([remarkCollabLinks])
    const journal = mdx.collections.journal({ remarkPlugins: [], rehypePlugins: [] })
    expect(journal).toMatchObject({ type: 'doc', dir: journalDirName, files: [journalFileGlob], async: true })
  })

  it('集合工厂的名单与 package.json 的 godDocsite.collections 一致：建站器按名单生成集合汇总', async () => {
    const mdx = await import('../template/mdx.ts')
    const manifest = JSON.parse(readFileSync(path.resolve(import.meta.dirname, '../package.json'), 'utf8')) as { godDocsite: { collections: string[] } }
    expect(Object.keys(mdx.collections)).toEqual(manifest.godDocsite.collections)
  })
})

describe('feature.tsx（运行时，浏览器侧也加载）', () => {
  it('只 import 浏览器能用的出口：没有 node:、./node、./site/server、.server 模块', () => {
    const serverOnly = importsOfFile(templateFile('feature.tsx')).filter((spec) => /^node:|\/node$|\/server$|\.server$/.test(spec))
    expect(serverOnly).toEqual([])
  })

  it('侧栏入口是「任务」「日历」两个站内地址，都带图标', async () => {
    const { sidebarLinks } = await import('../template/feature.tsx')
    expect(sidebarLinks.map(({ name, url }) => ({ name, url }))).toEqual([
      { name: '任务', url: tasksPageUrl },
      { name: '日历', url: calendarUrl },
    ])
    expect(sidebarLinks.every(({ icon }) => icon !== null && icon !== undefined)).toBe(true)
  })

  it('layoutData：公开人员（不带身份码）、本机身份、推送通道交来的通知；还没推过为 null，推来的形状不对就报错', async () => {
    const { layoutData } = await import('../template/feature.tsx')
    const notification = notificationOf({ kind: 'task', recordId: '20261001090000-aaaaaaa', title: '画采样板', due: null, detail: null })
    let pushed: unknown
    // layoutData 只用基础站点上下文的这三项
    const base = {
      people: () => [{ id: 'bob', name: '鲍勃', codes: ['bobcode2345'] }],
      identity: () => ({ person: { id: 'bob', name: '鲍勃' } }),
      feedValue: (channel: string) => (channel === 'collab' ? pushed : undefined),
    } as unknown as Parameters<typeof layoutData>[1]
    const args = { request: new Request('http://collab.test/'), params: {}, context: {} } as Parameters<typeof layoutData>[0]
    expect(layoutData(args, base)).toEqual({ people: [{ id: 'bob', name: '鲍勃' }], person: 'bob', notifications: null, aiPrompt: null })
    pushed = JSON.parse(JSON.stringify({ notifications: [notification], aiPrompt: '提示词', projectLeads: null }))
    expect(layoutData(args, base).notifications).toEqual([notification])
    expect(layoutData(args, base).aiPrompt).toBe('提示词')
    pushed = { notifications: 'none' }
    expect(() => layoutData(args, base)).toThrow(InvalidSiteFeed)
  })
})
