import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

const packageDir = path.resolve(import.meta.dirname, '..')
const packageJson = JSON.parse(readFileSync(path.join(packageDir, 'package.json'), 'utf8')) as { name: string; bin: Record<string, string>; files: string[] }
const workflow = readFileSync(path.join(packageDir, 'templates', 'collab-auto-merge.yaml'), 'utf8')

describe('随包发布的自动合并工作流', () => {
  it('执行器按 MERGE_CHECK_RANGE 装的是这个包，跑的是这个包的 collab-merge-check', () => {
    expect(workflow).toContain(`npm install --silent --no-audit --no-fund "${packageJson.name}@$MERGE_CHECK_RANGE"`)
    expect(workflow).toContain('"$tooldir/node_modules/.bin/collab-merge-check"')
    expect(Object.keys(packageJson.bin)).toContain('collab-merge-check')
    expect(packageJson.files).toContain('templates')
  })
})
