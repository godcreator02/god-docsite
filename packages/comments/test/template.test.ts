/**
 * 站点模板 template/：建站器原样复制到站点 app/features/comments/（基础站建好、装完依赖后由 addBaseFeatures 补进去）。
 * 文件齐全、随包发出去；/comments 路由指向模板目录里的页面；样式引入本包样式、把评论目录排除出 Tailwind 的扫描、带正文高亮。
 */
import { readFileSync, readdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { expect, test } from 'vitest'

const packageRoot = join(dirname(fileURLToPath(import.meta.url)), '..')
const templateDir = join(packageRoot, 'template')
const templateText = (file: string) => readFileSync(join(templateDir, file), 'utf8')

test('模板文件齐全，package.json 把 template 发出去', () => {
  expect(readdirSync(templateDir).sort()).toEqual(['comments.tsx', 'feature.tsx', 'routes.ts', 'styles.css'])
  const manifest = JSON.parse(readFileSync(join(packageRoot, 'package.json'), 'utf8')) as { files: string[] }
  expect(manifest.files).toContain('template')
})

test('routes.ts：/comments 在整站布局里，指向模板目录里的全站评论页；页面里有评论写入的 action', () => {
  expect(templateText('routes.ts')).toContain("export default [route('comments', './comments.tsx')]")
  const page = templateText('comments.tsx')
  expect(page).toMatch(/export async function action\(/)
  expect(page).toContain('handleCommentWrite')
})

test('feature.tsx：侧栏的「全站评论」入口指向 /comments', async () => {
  const { sidebarLinks } = await import('../template/feature.tsx')
  expect(sidebarLinks).toEqual([{ name: '全站评论', url: '/comments' }])
})

test('styles.css：引入本包样式，评论目录不进 Tailwind 的扫描（相对 app/features/comments/），带正文高亮', () => {
  const styles = templateText('styles.css')
  expect(styles).toContain("@import '@godcreator/comments/styles.css';")
  expect(styles).toContain("@source not '../../../comments';")
  expect(styles).toContain('::highlight(docsite-comment)')
})
