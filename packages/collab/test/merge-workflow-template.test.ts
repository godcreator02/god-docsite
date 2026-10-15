import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { mergeWorkflowPathInRepo, renderMergeWorkflow } from '../src/core/merge-workflow.js'

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

  it('写成协作仓里那份：{{version}} 换成 ^<版本>，Gitea Actions 自己的 ${{ … }} 原样留着', () => {
    const rendered = renderMergeWorkflow(workflow, '1.2.3')
    expect(rendered).toContain("MERGE_CHECK_RANGE: '^1.2.3'")
    expect(rendered).not.toContain('{{version}}')
    expect(rendered).toContain('BOT_TOKEN: ${{ secrets.COLLAB_BOT_TOKEN }}')
    expect(rendered.split('\n').length).toBe(workflow.split('\n').length)
    expect(mergeWorkflowPathInRepo).toBe('.gitea/workflows/collab-auto-merge.yaml')
  })

  it('模板里没有 {{version}}、或还有认不出的占位，都报错', () => {
    expect(() => renderMergeWorkflow("env:\n  MERGE_CHECK_RANGE: '^0.1.0'\n", '1.2.3')).toThrow('没有占位 {{version}}')
    expect(() => renderMergeWorkflow("env:\n  MERGE_CHECK_RANGE: '{{version}}'\n  OTHER: '{{ name }}'\n", '1.2.3')).toThrow('认不出的占位 {{ name }}')
  })
})
