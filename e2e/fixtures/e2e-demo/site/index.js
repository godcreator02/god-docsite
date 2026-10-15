// 不经构建：用 createElement 写组件，不用 JSX
import { createElement as h, useState } from 'react'
import { useFetcher, useLoaderData, useRouteLoaderData } from 'react-router'

/** 带 loader / action 的页面：计数存在站点 data/ 里，useFetcher 提交加一 */
export function DemoPage() {
  const { count } = useLoaderData()
  const fetcher = useFetcher()
  return h(
    'div',
    { 'data-e2e-demo-page': '', className: 'e2e-demo-styled', style: { gridArea: 'main', padding: '2rem' } },
    h('h1', null, '演示功能页'),
    h('p', null, '计数：', h('span', { 'data-e2e-demo-count': '' }, String(fetcher.data?.count ?? count))),
    h(fetcher.Form, { method: 'post' }, h('button', { type: 'submit', 'data-e2e-demo-increment': '', disabled: fetcher.state !== 'idle' }, '加一')),
  )
}

/** 独立页面：在整站布局之外，占满窗口；点一下加一，用来看水合 */
export function DemoFullPage() {
  const [count, setCount] = useState(0)
  return h(
    'main',
    { 'data-e2e-demo-full': '', style: { minHeight: '100vh', padding: '2rem' } },
    h('h1', null, '演示独立页'),
    h('button', { type: 'button', 'data-e2e-demo-full-counter': '', onClick: () => setCount((value) => value + 1) }, `独立页计数：${count}`),
  )
}

/** MDX 正文里直接写的组件：点一下加一，用来看水合 */
export function DemoCounter({ label = '演示计数' }) {
  const [count, setCount] = useState(0)
  return h('button', { type: 'button', 'data-e2e-demo-counter': '', onClick: () => setCount((value) => value + 1) }, `${label}：${count}`)
}

/** 布局顶部插槽：自己从布局路由的数据里取 e2e-demo 那份 */
export function DemoLayoutTop() {
  const data = useRouteLoaderData('routes/layout')?.['e2e-demo']
  return h('div', { 'data-e2e-demo-top': '', className: 'e2e-demo-top' }, data ? `演示顶栏：${data.viewer ?? '只读'}，共 ${data.pages} 页，推送 ${data.pushed ?? '无'}` : '演示顶栏：没有布局数据')
}

/** 页面树插件：侧栏根部末尾加一个入口 */
export function demoPageTreePlugin({ name, url }) {
  return {
    name: 'e2e-demo:page-tree',
    transformPageTree: {
      root(root) {
        root.children.push({ type: 'page', name, url, $id: `e2e-demo:${url}` })
        return root
      },
    },
  }
}

/** 集合页面：集合在浏览器端的 client loader 按路径加载正文，路径与标题来自页面 loader */
export function createNotePage(browserCollection) {
  const content = browserCollection.createClientLoader({
    id: 'e2e-demo-notes',
    component: ({ default: Mdx }) => h('div', { 'data-e2e-demo-note-body': '' }, h(Mdx)),
  })
  return function NotePage() {
    const { path, title } = useLoaderData()
    return h('div', { 'data-e2e-demo-note': '', style: { gridArea: 'main', padding: '2rem' } }, h('h1', null, title), content.useContent(path))
  }
}
