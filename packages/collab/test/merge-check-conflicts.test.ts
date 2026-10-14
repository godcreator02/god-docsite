import { rmSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { aliceTaskId, bobTaskId, check, commit, git, laterTaskId, repo, write, writeTask } from './merge-check-repo.js'

describe('合并检查：和 main 有没有冲突', () => {
  it('新加一条记录，能合并', async () => {
    writeTask(bobTaskId, 'bob', '写跨时钟域测试')
    commit('bob 加任务')
    expect(await check()).toEqual({ verdict: 'mergeable', problems: [] })
  })

  it('两边改了同一条记录的同一行，是冲突', async () => {
    writeTask(aliceTaskId, 'alice', '画子模块板原理图（乙改）')
    commit('head 改标题')
    git('checkout', '-q', 'main')
    writeTask(aliceTaskId, 'alice', '画子模块板原理图（甲改）')
    commit('main 改标题')
    const result = await check()
    expect(result.verdict).toBe('conflict')
    expect(result.problems).toHaveLength(1)
  })

  it('记录和页面、组件、静态文件一起改，能合并', async () => {
    writeTask(bobTaskId, 'bob', '写跨时钟域测试')
    write('site/pages/home/page.mdx', "import { Chart } from '../../shared/Chart'\n\n# 首页（乙改）\n\n<Chart />\n")
    write('site/shared/Chart.tsx', "export function Chart() {\n  return <img src=\"/chart.webp\" />\n}\n")
    write('site/public/chart.webp', 'webp')
    commit('乙加了一页图')
    expect(await check('topic')).toEqual({ verdict: 'mergeable', problems: [] })
  })

  it('成员加库、升级库，改 tsconfig、index.html、锁文件，在站点里新建目录：都放行', async () => {
    write('site/package.json', `${JSON.stringify({ dependencies: { react: '^19.4.0', three: '^0.186.0' }, devDependencies: { '@types/three': '^0.186.0' } }, null, 2)}\n`)
    write('site/pnpm-lock.yaml', "lockfileVersion: '9.0'\n")
    write('site/tsconfig.json', '{ "compilerOptions": { "strict": true } }\n')
    write('site/index.html', '<!doctype html><title>站</title>\n')
    write('site/components/Plot.tsx', "import * as THREE from 'three'\nexport const Plot = () => String(THREE.REVISION)\n")
    write('README.md', '# 项目\n')
    commit('乙加了 three，顺手改了几处配置')
    expect(await check('topic')).toEqual({ verdict: 'mergeable', problems: [] })
  })

  it('记录写坏了、页面引用了不存在的组件：不在这里查，照样能合并（成员提交前在本机查）', async () => {
    write(`collab/records/${bobTaskId}.json`, '{ "id": 坏的')
    write('site/pages/research/page.mdx', "import { Timeline } from '../../shared/explain/timeline'\n\n# 调研\n")
    commit('写坏一条记录、一页引用找不到')
    expect(await check('topic')).toEqual({ verdict: 'mergeable', problems: [] })
  })

  it('改别人的记录、删记录都不挡：不查谁改了谁', async () => {
    writeTask(aliceTaskId, 'alice', '乙改了甲的标题')
    commit('乙改甲的任务')
    rmSync(path.join(repo, `collab/records/${aliceTaskId}.json`))
    commit('乙删了甲的任务')
    expect(await check()).toEqual({ verdict: 'mergeable', problems: [] })
  })

  it('head 落后于 main：main 后来加的记录不算 head 删的', async () => {
    writeTask(bobTaskId, 'bob', '写跨时钟域测试')
    commit('bob 加任务')
    git('checkout', '-q', 'main')
    writeTask(laterTaskId, 'alice', '整理手册')
    commit('main 后来又加一条')
    expect(await check()).toEqual({ verdict: 'mergeable', problems: [] })
  })

  it('head 可以是提交号', async () => {
    writeTask(bobTaskId, 'bob', '写跨时钟域测试')
    const sha = commit('bob 加任务')
    expect((await check(sha)).verdict).toBe('mergeable')
  })
})
