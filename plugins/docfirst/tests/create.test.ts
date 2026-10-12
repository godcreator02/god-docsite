import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { DOCFIRST_SITE_FEATURE } from '../src/deps.js'

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '../../..')

/** deps.ts 那张表：精确号、跟工作区各包的版本对得上——包升了版本号忘改表，这条红 */
describe('DOCFIRST_SITE_FEATURE', () => {
  it('是精确号，跟工作区 docfirst-site 的版本一致', () => {
    expect(Object.keys(DOCFIRST_SITE_FEATURE)).toEqual(['@godcreator/docfirst-site'])
    for (const [name, version] of Object.entries(DOCFIRST_SITE_FEATURE)) {
      expect(version, `${name} 要写精确号`).toMatch(/^\d+\.\d+\.\d+$/)
      const manifest = JSON.parse(readFileSync(path.join(ROOT, 'packages', name.replace('@godcreator/', ''), 'package.json'), 'utf8')) as { version: string }
      expect(version, `${name} 工作区是 ${manifest.version}，表里是 ${version}：发版时忘了改表`).toBe(manifest.version)
    }
  })
})
