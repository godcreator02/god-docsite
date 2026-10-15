import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { pluginDir } from '../src/scaffold/platform.js'

describe('随插件发的说明书', () => {
  it('四份说明书都在、skills 在 files 里：漏了照样能发布、能安装，直到注册时扫描目录才报读不到', () => {
    const manifest = JSON.parse(fs.readFileSync(path.join(pluginDir, 'package.json'), 'utf8')) as { files?: string[] }
    expect(manifest.files).toContain('skills')
    for (const skill of ['docsite', 'docs-site', 'docs-writing', 'trajectory']) {
      expect(fs.readFileSync(path.join(pluginDir, 'skills', skill, 'SKILL.md'), 'utf8'), `skills/${skill}/SKILL.md`).toMatch(new RegExp(`^---\\s*\\nname: ${skill}\\n`))
    }
  })
})
