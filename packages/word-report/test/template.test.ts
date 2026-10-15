/**
 * 站点模板 template/：建站器原样复制到站点 app/features/word-report/。文件齐全、路由地址与文件对得上、包把模板与引擎发出去。
 */
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { expect, test } from 'vitest'
import routes from '../template/routes.ts'
import { reportHrefBase } from '../template/href.ts'

const PKG_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const TEMPLATE = join(PKG_ROOT, 'template')

test('模板文件齐全', () => {
  expect(readdirSync(TEMPLATE).sort()).toEqual(['asset.ts', 'feature.tsx', 'href.ts', 'list.tsx', 'report.tsx', 'routes.ts', 'site.server.ts', 'styles.css'])
})

test('routes.ts：列表、报告页、图片三条路由都在整站布局里，地址前缀是 href.ts 的 reportHrefBase', () => {
  expect(routes.map((entry) => [entry.path, resolve(entry.file)])).toEqual([
    ['reports', join(TEMPLATE, 'list.tsx')],
    ['reports/:report', join(TEMPLATE, 'report.tsx')],
    ['reports/:report/assets/*', join(TEMPLATE, 'asset.ts')],
  ])
  for (const entry of routes) expect(entry.path?.startsWith(reportHrefBase.slice(1))).toBe(true)
})

test('package.json 把模板、样式与 Word 引擎发出去，命令行是 report-docx', () => {
  const pkg = JSON.parse(readFileSync(join(PKG_ROOT, 'package.json'), 'utf8')) as { files: string[]; bin: Record<string, string> }
  for (const entry of ['template', 'styles', 'engine/templates', 'engine/src/docreport']) expect(pkg.files).toContain(entry)
  // devkit.release 组装发布内容时按字面复制 files，不认通配与否定式
  expect(pkg.files.filter((entry) => entry.startsWith('!') || /[*?]/.test(entry))).toEqual([])
  expect(pkg.bin).toEqual({ 'report-docx': './dist/cli.mjs' })
  expect(existsSync(join(PKG_ROOT, 'engine', 'templates', 'project-report.dotx'))).toBe(true)
})

test('styles.css 引入本包样式，报告目录不进 Tailwind 的源码扫描', () => {
  const css = readFileSync(join(TEMPLATE, 'styles.css'), 'utf8')
  expect(css).toMatch(/@import '@godcreator\/word-report\/styles\.css';/)
  expect(css).toMatch(/@source not '\.\.\/\.\.\/\.\.\/reports';/)
})
