/**
 * 站点模板 template/：建站器原样复制到站点 app/features/identity/（基础站建好、装完依赖后由 addBaseFeatures 补进去）。
 * 文件齐全、随包发出去；头像写入路由的地址和 avatarWriteUrl 一致，action 交给 handleAvatarWrite。
 */
import { readFileSync, readdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { expect, test } from 'vitest'
import { avatarWriteUrl } from '../src/core/index.js'

const packageRoot = join(dirname(fileURLToPath(import.meta.url)), '..')
const templateDir = join(packageRoot, 'template')
const templateText = (file: string) => readFileSync(join(templateDir, file), 'utf8')

test('模板文件齐全，package.json 把 template 发出去', () => {
  expect(readdirSync(templateDir).sort()).toEqual(['avatar.ts', 'routes.ts'])
  const manifest = JSON.parse(readFileSync(join(packageRoot, 'package.json'), 'utf8')) as { files: string[] }
  expect(manifest.files).toContain('template')
})

test('routes.ts：头像写入路由的地址就是 avatarWriteUrl，指向模板目录里的 avatar.ts；它的 action 交给 handleAvatarWrite', () => {
  expect(templateText('routes.ts')).toContain(`export default [route('${avatarWriteUrl.slice(1)}', './avatar.ts')]`)
  const route = templateText('avatar.ts')
  expect(route).toMatch(/export async function action\(/)
  expect(route).toContain('handleAvatarWrite')
})
