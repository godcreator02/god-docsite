// 评论数据层的真实运行时测试：公开的 readCommentThreads 读盘 + 官方 @mdx-js/mdx 编译 + 浏览器端 run 的还原。
// 在 site 目录运行：..\..\packages\docsite-kit\node_modules\.bin\vitest.ps1 run --config test/vitest.config.mjs
import { test, expect } from '../../../../packages/docsite-kit/node_modules/vitest/dist/index.js'
import { renderToStaticMarkup } from 'react-dom/server'
import { createElement } from 'react'
import * as reactJsxRuntime from 'react/jsx-runtime'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { commentsPageData, allCommentsData } from '../app/lib/comment-data.server.js'

const site = fileURLToPath(new URL('../', import.meta.url))
process.chdir(site)

test('每次调用都重新读盘并按 CommentEntry 形状投影，正文是 function-body 编译产物', async () => {
  const data = await allCommentsData()
  const sample = data.threads.find((thread) => thread.id === '2026-10-12-mdx-capabilities')
  expect(sample, '能力样本串在').toBeDefined()
  expect(sample!.head.info.path).toBe('2026-10-12-mdx-capabilities/index.mdx')
  expect(sample!.head.kind).toBe('thread')
  expect(sample!.head.author).toBe('zk')
  // function-body 的形状特征：从参数里解构 jsx 运行时
  expect(sample!.head.body).toContain('arguments[0]')
  expect(sample!.head.body).toContain('_jsx')
  // 同目录组件引用被编译成相对 baseUrl 的动态 import，图片相对地址保留在产物里
  expect(sample!.head.body).toContain(`_resolveDynamicMdxSpecifier('./Dot.tsx')`)
  expect(sample!.head.body).toContain('./paste-dot.png')
  // 快照：不挂页面的串没有；demo 页的串有
  const pageData = await commentsPageData('/comments-demo')
  expect(pageData.threads.length).toBeGreaterThan(0)
  expect(Object.keys(pageData.snapshots).length).toBeGreaterThan(0)
})

test('编译产物经 run 还原成组件：真实 react 渲染出加粗与链接（用无组件 import 的种子串）', async () => {
  const data = await allCommentsData()
  const seed = data.threads.find((thread) => thread.id === '2026-10-11-seed-welcome')
  expect(seed).toBeDefined()
  const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor
  const module = await new AsyncFunction(String(seed!.head.body))({ ...reactJsxRuntime, baseUrl: new URL(`file://${path.join(site, 'comments', seed!.id)}/`) })
  const html = renderToStaticMarkup(createElement(module.default))
  expect(html).toContain('<strong>加粗</strong>')
  expect(html).toContain('href="https://example.com"')
})

test('同一次读取的数据自洽：aboutMe 有 zk（他发起的串），身份与人员是公开形状', async () => {
  process.env.DOCSITE_IDENTITY_CODE = 'k8v1r2w3x4'
  try {
    const data = await allCommentsData()
    expect(data.aboutMe).toContain('2026-10-12-mdx-capabilities')
    expect(data.people.every((person) => !('codes' in person))).toBe(true)
    expect(data.identity.person === null || !('codes' in data.identity.person)).toBe(true)
  } finally {
    delete process.env.DOCSITE_IDENTITY_CODE
  }
})
