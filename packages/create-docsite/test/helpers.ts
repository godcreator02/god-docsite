import * as crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { CreateSiteError } from '../src/plan.ts'

/** 本轮任务专属材料目录（probes 下的 create-core），测试临时目录全部放在它的 tmp/ 里 */
export const createCoreAreaPath = fileURLToPath(
  new URL('../../../probes/2610112023_docsite-kit-complete/package-split/create-core', import.meta.url),
)

/** 建一个本轮唯一的临时根目录；调用方负责删除（describe 的 afterEach 里统一删） */
export function makeTempRoot(label: string): string {
  const area = path.join(createCoreAreaPath, 'tmp')
  fs.mkdirSync(area, { recursive: true })
  return fs.mkdtempSync(path.join(area, `${label}-`))
}

/** 256 字节、覆盖较多字节值的二进制样本 */
export const binaryFixture: Buffer = Buffer.from(Array.from({ length: 256 }, (_, index) => (index * 7 + 29) % 256))

/** 写一份标准测试模板（单一普通文件树）：多层骨架 + 顶层 gitignore + 二进制 + 数据材料默认值 */
export function writeSampleTemplate(templateDir: string): void {
  const files: Array<[string, string | Buffer]> = [
    ['package.json', '{\n  "name": "sample-site"\n}\n'],
    ['vite.config.ts', 'export default {}\n'],
    ['gitignore', 'node_modules\n'],
    ['app/root.tsx', '中文正文 root\n'],
    ['app/routes/page.tsx', 'export function Page() { return null }\n'],
    ['app/assets/logo.png', binaryFixture],
    ['app/lib/deep/nested.ts', 'export const deep = 1\n'],
    ['content/index.mdx', '# 首页\n'],
    ['people.json', '{\n  "people": []\n}\n'],
  ]
  for (const [relativePath, content] of files) {
    const target = path.join(templateDir, ...relativePath.split('/'))
    fs.mkdirSync(path.dirname(target), { recursive: true })
    fs.writeFileSync(target, content)
  }
}

/** 模板全部文件写进空目标后的期望清单（含创建标记），正斜杠、排序后 */
export function expectedCreatedFilesForFullTemplate(): string[] {
  return [
    '.create-docsite.json',
    '.gitignore',
    'app/assets/logo.png',
    'app/lib/deep/nested.ts',
    'app/root.tsx',
    'app/routes/page.tsx',
    'content/index.mdx',
    'package.json',
    'people.json',
    'vite.config.ts',
  ]
}

/** 跑一段应当抛 CreateSiteError 的代码，断言类型并交回错误供逐字段断言 */
export function expectCreateSiteError(run: () => unknown): CreateSiteError {
  try {
    run()
  } catch (error) {
    if (!(error instanceof CreateSiteError)) throw new Error(`期望 CreateSiteError，抛的是：${String(error)}`)
    return error
  }
  throw new Error('期望抛出 CreateSiteError，但一次就成功了')
}

/** 整棵目录树的相对路径 → 内容 sha256，用于「一个字节都没变」类断言 */
export function fileHashesUnder(dir: string): Map<string, string> {
  const hashes = new Map<string, string>()
  const walk = (currentDir: string, prefix: string) => {
    for (const entry of fs.readdirSync(currentDir, { withFileTypes: true })) {
      const entryPath = path.join(currentDir, entry.name)
      const relativePath = prefix === '' ? entry.name : `${prefix}/${entry.name}`
      if (entry.isDirectory()) walk(entryPath, relativePath)
      else hashes.set(relativePath, crypto.createHash('sha256').update(fs.readFileSync(entryPath)).digest('hex'))
    }
  }
  walk(dir, '')
  return hashes
}

/** Windows 上建 junction（不需要管理员权限）；别的平台返回 false 表示没建 */
export function tryCreateJunction(junctionPath: string, targetDir: string): boolean {
  if (process.platform !== 'win32') return false
  fs.mkdirSync(targetDir, { recursive: true })
  fs.symlinkSync(targetDir, junctionPath, 'junction')
  return true
}
