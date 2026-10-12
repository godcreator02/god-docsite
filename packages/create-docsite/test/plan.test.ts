import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import {
  dirContainsDir,
  isDataMaterialPath,
  lstatOrNull,
  realPathIfExisting,
  scanSiteTemplate,
  windowsFileNameProblem,
} from '../src/plan.ts'
import { makeTempRoot, expectCreateSiteError, tryCreateJunction, writeSampleTemplate } from './helpers.ts'

let root: string
beforeEach(() => {
  root = makeTempRoot('plan')
})
afterEach(() => {
  fs.rmSync(root, { recursive: true, force: true })
})

describe('windowsFileNameProblem', () => {
  it('保留名、非法字符、点结尾都拦，正常名与 .gitignore 放行', () => {
    expect(windowsFileNameProblem('CON')).toBe('Windows 保留了这个名字：CON')
    expect(windowsFileNameProblem('con.x.txt')).toMatch(/保留了/)
    expect(windowsFileNameProblem('a<b.txt')).toMatch(/不允许的字符/)
    expect(windowsFileNameProblem('尾部点.')).toMatch(/以点或空格结尾/)
    expect(windowsFileNameProblem('尾部空格 ')).toMatch(/以点或空格结尾/)
    expect(windowsFileNameProblem('.gitignore')).toBe(null)
    expect(windowsFileNameProblem('普通文件.mdx')).toBe(null)
    expect(windowsFileNameProblem('com3')).toBe('Windows 保留了这个名字：com3')
    expect(windowsFileNameProblem('lpt9')).toBe('Windows 保留了这个名字：lpt9')
    expect(windowsFileNameProblem('com10')).toBe(null)
  })
})

describe('isDataMaterialPath', () => {
  it('content/、comments/ 前缀与顶层 people.json 算数据材料，其余不算', () => {
    expect(isDataMaterialPath('content/index.mdx')).toBe(true)
    expect(isDataMaterialPath('content/子目录/页面.mdx')).toBe(true)
    expect(isDataMaterialPath('comments/1.json')).toBe(true)
    expect(isDataMaterialPath('people.json')).toBe(true)
    expect(isDataMaterialPath('app/root.tsx')).toBe(false)
    expect(isDataMaterialPath('package.json')).toBe(false)
    expect(isDataMaterialPath('people/xxx.json')).toBe(false)
    expect(isDataMaterialPath('contentx/a.mdx')).toBe(false)
  })
})

describe('dirContainsDir', () => {
  it('包含与相等算 true，兄弟目录算 false（真实目录 IO）', () => {
    const outer = path.join(root, 'outer')
    const inner = path.join(outer, 'inner')
    const sibling = path.join(root, 'other')
    fs.mkdirSync(inner, { recursive: true })
    fs.mkdirSync(sibling, { recursive: true })
    expect(dirContainsDir(outer, inner)).toBe(true)
    expect(dirContainsDir(outer, outer)).toBe(true)
    expect(dirContainsDir(outer, sibling)).toBe(false)
    expect(dirContainsDir(inner, outer)).toBe(false)
    const namePrefixedSibling = path.join(root, 'outer-2')
    fs.mkdirSync(namePrefixedSibling)
    expect(dirContainsDir(outer, namePrefixedSibling)).toBe(false)
  })
})

describe('realPathIfExisting', () => {
  it('存在的路径给真实路径，不存在的拼最长存在前缀', () => {
    const existing = path.join(root, 'exists')
    fs.mkdirSync(existing)
    expect(realPathIfExisting(existing)).toBe(fs.realpathSync(existing))
    expect(realPathIfExisting(path.join(existing, 'sub'))).toBe(path.join(fs.realpathSync(existing), 'sub'))
    expect(realPathIfExisting(path.join(existing, 'sub', 'deeper', 'leaf'))).toBe(
      path.join(fs.realpathSync(existing), 'sub', 'deeper', 'leaf'),
    )
    const nowhere = path.join(root, 'nowhere')
    expect(realPathIfExisting(nowhere)).toBe(path.resolve(nowhere))
  })

  it.skipIf(process.platform !== 'win32')('父段是 junction 时解析到真实位置', () => {
    const realDir = path.join(root, 'real-dir')
    const junctionPath = path.join(root, 'j-link')
    expect(tryCreateJunction(junctionPath, realDir)).toBe(true)
    expect(realPathIfExisting(path.join(junctionPath, 'not-yet-existing'))).toBe(
      path.join(realDir, 'not-yet-existing'),
    )
  })
})

describe('scanSiteTemplate', () => {
  it('扫出单一文件树，按目标路径分成骨架与数据材料，映射顶层 gitignore，按名排序', () => {
    const templateDir = path.join(root, 'template')
    writeSampleTemplate(templateDir)
    const plan = scanSiteTemplate(templateDir)
    expect(plan.skeletonFiles.map((file) => file.relativePath)).toEqual([
      '.gitignore',
      'app/assets/logo.png',
      'app/lib/deep/nested.ts',
      'app/root.tsx',
      'app/routes/page.tsx',
      'package.json',
      'vite.config.ts',
    ])
    expect(plan.dataMaterialFiles.map((file) => file.relativePath)).toEqual(['content/index.mdx', 'people.json'])
    for (const file of [...plan.skeletonFiles, ...plan.dataMaterialFiles]) {
      expect(fs.statSync(file.sourcePath).isFile()).toBe(true)
      expect(file.sourcePath.startsWith(fs.realpathSync(templateDir))).toBe(true)
    }
  })

  it('模板根不存在或不是目录时拒绝', () => {
    const missing = expectCreateSiteError(() => scanSiteTemplate(path.join(root, 'no-such-template')))
    expect(missing.code).toBe('template-error')
    expect(missing.message).toMatch(/不存在/)
    const filePath = path.join(root, 'template.txt')
    fs.writeFileSync(filePath, '不是目录')
    const notDir = expectCreateSiteError(() => scanSiteTemplate(filePath))
    expect(notDir.code).toBe('template-error')
    expect(notDir.message).toMatch(/不是目录/)
  })

  it.skipIf(process.platform !== 'win32')('模板里的 junction 拒绝', () => {
    const templateDir = path.join(root, 'template')
    fs.mkdirSync(templateDir, { recursive: true })
    fs.writeFileSync(path.join(templateDir, 'package.json'), '{}\n')
    const outside = path.join(root, 'outside')
    expect(tryCreateJunction(path.join(templateDir, 'linked'), outside)).toBe(true)
    fs.writeFileSync(path.join(outside, 'escaped.txt'), '越界内容')
    const error = expectCreateSiteError(() => scanSiteTemplate(templateDir))
    expect(error.code).toBe('template-error')
    expect(error.message).toMatch(/符号链接或 junction/)
  })
})

describe('lstatOrNull', () => {
  it('不存在给 null，存在给 Stats', () => {
    const file = path.join(root, 'here.txt')
    fs.writeFileSync(file, 'x')
    expect(lstatOrNull(file)).not.toBe(null)
    expect(lstatOrNull(path.join(root, 'missing.txt'))).toBe(null)
  })
})
