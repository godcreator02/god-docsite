import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { MIN_KIT_VERSION, checkKitVersion, compareVersions } from '../src/kit-contract.js'

let siteDir: string

beforeEach(async () => {
  siteDir = await mkdtemp(path.join(tmpdir(), 'docsite-kit-contract-'))
})

afterEach(async () => {
  await rm(siteDir, { recursive: true })
})

/** 在站点的 node_modules 里放一版基础包 */
async function installKit(version: string): Promise<void> {
  const dir = path.join(siteDir, 'node_modules', '@godcreator', 'docsite-kit')
  await mkdir(dir, { recursive: true })
  await writeFile(path.join(dir, 'package.json'), JSON.stringify({ name: '@godcreator/docsite-kit', version }))
}

describe('三段数字版本比较', () => {
  it('按数字比，不按字符串比', () => {
    expect(compareVersions('0.1.7', '0.1.10')).toBeLessThan(0)
    expect(compareVersions('0.2.0', '0.1.99')).toBeGreaterThan(0)
    expect(compareVersions('1.0.0', '0.9.9')).toBeGreaterThan(0)
    expect(compareVersions('0.1.9', '0.1.9')).toBe(0)
  })

  it('不是三段数字就报错', () => {
    for (const version of ['0.1', '0.1.x', '0.1.9-beta', 'v0.1.9', '']) {
      expect(() => compareVersions(version, '0.1.9')).toThrow(`版本号要是三段数字（如 0.1.9），读到 ${version}`)
    }
  })
})

describe('启动前的版本核对', () => {
  it('低于插件支持的最低版就拒绝，写明要升到哪版', async () => {
    await installKit('0.1.9')
    expect(() => checkKitVersion(siteDir)).toThrow(`装的 @godcreator/docsite-kit 0.1.9 低于插件支持的最低版 ${MIN_KIT_VERSION}`)
    expect(() => checkKitVersion(siteDir)).toThrow(`"^${MIN_KIT_VERSION}"`)
    await installKit(MIN_KIT_VERSION)
    expect(() => checkKitVersion(siteDir)).not.toThrow()
    await installKit('0.2.0')
    expect(() => checkKitVersion(siteDir)).not.toThrow()
  })

  it('没装基础包就报错说先装依赖', () => {
    expect(() => checkKitVersion(siteDir)).toThrow(`node_modules 里没有 @godcreator/docsite-kit：在站点目录里运行 pnpm install`)
  })
})
