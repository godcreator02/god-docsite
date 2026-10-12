import { execFileSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { beforeEach, describe, expect, it } from 'vitest'
import { checkMerge } from '../src/check.js'
import { runMergeCheckCli } from '../src/cli.js'

const people = `${JSON.stringify(
  [
    { id: 'alice', name: '甲', codes: ['alicecode001'], gitea: 'alice' },
    { id: 'bob', name: '乙', gitea: 'bob' },
  ],
  null,
  2,
)}\n`

/** 合并检查不解码记录，记录文件写成什么样都行；这里照记录的样子写，一个字段一行 */
const taskText = (id: string, author: string, title: string) => `${JSON.stringify({ id, type: 'task', author, status: 'todo', title }, null, 2)}\n`
const aliceTaskId = '20260930100000-aaaaaaa'
const bobTaskId = '20260930110000-bbbbbbb'
const laterTaskId = '20260930120000-ccccccc'

let repo: string
const git = (...args: string[]) => execFileSync('git', args, { cwd: repo, encoding: 'utf8' })

function write(relative: string, content: string) {
  const file = path.join(repo, relative)
  mkdirSync(path.dirname(file), { recursive: true })
  writeFileSync(file, content)
}

const writeTask = (id: string, author: string, title: string) => write(`collab/records/${id}.json`, taskText(id, author, title))

function commit(message: string) {
  git('add', '-A')
  git('commit', '-q', '-m', message)
  return git('rev-parse', 'HEAD').trim()
}

/** main 上有人员列表与甲的一条任务；topic 分支从这里分出（不叫 head：Windows 上它和 HEAD 是同一个引用） */
beforeEach(() => {
  repo = mkdtempSync(path.join(tmpdir(), 'collab-merge-'))
  git('init', '-q', '-b', 'main')
  git('config', 'user.name', 'probe')
  git('config', 'user.email', 'probe@local')
  git('config', 'core.autocrlf', 'false')
  write('site/people.json', people)
  writeTask(aliceTaskId, 'alice', '画子模块板原理图')
  write('site/package.json', `${JSON.stringify({ dependencies: { react: '^19.3.0' } }, null, 2)}\n`)
  write('site/pages/home/page.mdx', '# 首页\n')
  commit('base')
  git('checkout', '-q', '-b', 'topic')
})

/** author 为 null 时不说提交的人是谁 */
const check = (head = 'topic', authorIsLead = false, author: string | null = 'bob') =>
  checkMerge({ repo, base: 'main', head, collabPathInRepo: 'collab', sitePathInRepo: 'site', authorIsLead, ...(author === null ? {} : { author }) })

/** 人员列表改一处：按 id 找到那一项，换成 change 算出的样子 */
function writePeople(change: (person: Record<string, unknown>) => Record<string, unknown>) {
  const list = JSON.parse(people) as Array<Record<string, unknown>>
  write('site/people.json', `${JSON.stringify(list.map(change), null, 2)}\n`)
}

describe('合并检查：没冲突、没改只有负责人能改的内容', () => {
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

  it('成员改了工作流、人员列表、装包设置、Node 会执行的配置、scripts、框架包版本、写成网址的依赖：只有负责人能改，逐处写明', async () => {
    write(
      'site/package.json',
      `${JSON.stringify({ scripts: { dev: 'vite' }, dependencies: { react: '^19.3.0', '@godcreator/collab-site': '^0.1.0', evil: 'https://example.org/evil.tgz' } }, null, 2)}\n`,
    )
    write('.gitea/workflows/collab-auto-merge.yaml', 'name: 改过\n')
    write('.github/workflows/steal.yaml', 'name: 新加\n')
    write('site/people.json', people.replace('乙', '乙改名'))
    write('site/.npmrc', 'registry=https://example.org/\n')
    write('site/pnpm-workspace.yaml', 'onlyBuiltDependencies: [evil]\n')
    write('site/vite.config.ts', 'export default {}\n')
    write('site/postcss.config.mjs', 'export default {}\n')
    commit('乙改了一堆只有负责人能改的东西')
    const result = await check('topic')
    expect(result.verdict).toBe('needs-review')
    expect(result.problems[0]).toBe(
      '改了只有负责人能改的内容：.gitea/workflows/collab-auto-merge.yaml、.github/workflows/steal.yaml、site/.npmrc、' +
        'site/package.json 的 scripts、site/package.json 里 @godcreator/collab-site 的版本、site/package.json 里 evil 写成了 "https://example.org/evil.tgz"（只能写版本号范围）、' +
        'site/people.json、site/pnpm-workspace.yaml、site/postcss.config.mjs、site/vite.config.ts；这类改动交给负责人（协作仓的协作者）提交',
    )
  })

  it('成员给人员列表里自己那一项加身份码：放行', async () => {
    writePeople((person) => (person.gitea === 'bob' ? { ...person, codes: ['bobcode00001'] } : person))
    commit('乙在本机用协作站，写进身份码')
    expect(await check('topic')).toEqual({ verdict: 'mergeable', problems: [] })
  })

  it('人员列表里给别人加码、顺手改自己的名字、加一项、不说提交的人是谁：都只有负责人能改', async () => {
    const attempts: Array<[string, (person: Record<string, unknown>) => Record<string, unknown>, string | null]> = [
      ['给甲加码', (person) => (person.gitea === 'alice' ? { ...person, codes: ['alicecode001', 'bobcode00001'] } : person), 'bob'],
      ['改自己的名字', (person) => (person.gitea === 'bob' ? { ...person, name: '乙改名', codes: ['bobcode00001'] } : person), 'bob'],
      ['不说提交的人是谁', (person) => (person.gitea === 'bob' ? { ...person, codes: ['bobcode00001'] } : person), null],
    ]
    for (const [message, change, author] of attempts) {
      git('checkout', '-q', '-B', 'topic', 'main')
      writePeople(change)
      commit(message)
      expect((await check('topic', false, author)).problems, message).toEqual([expect.stringContaining('site/people.json')])
    }
    git('checkout', '-q', '-B', 'topic', 'main')
    write('site/people.json', `${JSON.stringify([...JSON.parse(people), { id: 'bob2', name: '乙二', gitea: 'bob' }], null, 2)}\n`)
    commit('加一项')
    expect((await check('topic')).verdict).toBe('needs-review')
  })

  it('协作仓的负责人改了只有负责人能改的内容，直接放行', async () => {
    write('site/package.json', `${JSON.stringify({ scripts: { dev: 'vite --port 4400' }, dependencies: { react: '^19.3.0' } }, null, 2)}\n`)
    commit('甲改了开发服务的端口')
    expect(await check('topic', true)).toEqual({ verdict: 'mergeable', problems: [] })
    expect((await check('topic', false)).verdict).toBe('needs-review')
  })

  it('site/package.json 写坏了：看不出改了哪几处，整个文件算只有负责人能改', async () => {
    write('site/package.json', '{ "dependencies": \n')
    commit('乙写坏了 package.json')
    expect(await check('topic')).toEqual({
      verdict: 'needs-review',
      problems: ['改了只有负责人能改的内容：site/package.json；这类改动交给负责人（协作仓的协作者）提交'],
    })
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

describe('命令行 collab-merge-check', () => {
  it('能合并时退出码 0', async () => {
    writeTask(bobTaskId, 'bob', '写跨时钟域测试')
    commit('bob 加任务')
    const result = await runMergeCheckCli(['--base', 'main', '--head', 'topic', '--author', 'bob', '--leads', 'alice'], repo)
    expect(result.exitCode).toBe(0)
  })

  it('不能合并时退出码 1，逐条列出问题', async () => {
    writeTask(bobTaskId, 'bob', '写跨时钟域测试')
    write('site/package.json', '{ "scripts": { "dev": "vite" }, "dependencies": { "react": "^19.3.0" } }\n')
    commit('改了 scripts')
    const result = await runMergeCheckCli(['--base', 'main', '--head', 'topic', '--author', 'bob', '--leads', 'alice'], repo)
    expect(result.exitCode).toBe(1)
    expect(result.output).toContain('site/package.json 的 scripts')
  })

  it('--author 在 --leads 里时，只有负责人能改的内容放行', async () => {
    write('site/package.json', '{ "scripts": { "dev": "vite" }, "dependencies": { "react": "^19.3.0" } }\n')
    commit('甲改了 scripts')
    const result = await runMergeCheckCli(['--base', 'main', '--head', 'topic', '--author', 'alice', '--leads', 'carol,alice'], repo)
    expect(result.exitCode).toBe(0)
  })

  it.each([
    [['--head', 'topic']],
    [['--base', 'main', '--head', 'topic', '--collab', 'docs/collab']],
    [['--base', 'main']],
    [['--base', 'main', '--head']],
    [['--base', 'main', '--head', 'topic', '--as', 'bob']],
    [['--base', 'main', '--head', 'topic', 'extra']],
    [['--base', 'main', '--head', 'topic', '--author', 'bob']],
    [['--base', 'main', '--head', 'topic', '--author', 'bob', '--leads', 'alice,']],
  ])('参数不对时退出码 2：%j', async (args) => {
    const result = await runMergeCheckCli(args, repo)
    expect(result.exitCode).toBe(2)
    expect(result.output).toContain('用法')
  })

  it('检查自己出错（不在 git 仓里运行）也是退出码 2，打印原话，和「不能合并」的退出码 1 分开', async () => {
    const notARepo = mkdtempSync(path.join(tmpdir(), 'collab-merge-not-a-repo-'))
    try {
      const result = await runMergeCheckCli(['--base', 'main', '--head', 'topic', '--author', 'bob', '--leads', 'alice'], notARepo)
      expect(result.exitCode).toBe(2)
      expect(result.output).toMatch(/合并检查自己出错了：git rev-parse --show-toplevel 失败[\s\S]*not a git repository/)
    } finally {
      rmSync(notARepo, { recursive: true, force: true })
    }
  })

  it('head 指向不存在的版本（merge-tree 退出码 1、没列冲突文件）：也算检查自己出错，退出码 2、带上 git 的原话，不列成「不能合并」', async () => {
    const result = await runMergeCheckCli(['--base', 'main', '--head', 'no-such-branch', '--author', 'bob', '--leads', 'alice'], repo)
    expect(result.exitCode).toBe(2)
    expect(result.output).toMatch(/合并检查自己出错了：git merge-tree main no-such-branch 失败：merge-tree: no-such-branch - not something we can merge/)
  })
})

describe('合并检查包的边界', () => {
  it('别的包只引用数据模型包的 project-model：执行器只装这个包和没有依赖的数据模型包', () => {
    const srcDir = path.resolve(import.meta.dirname, '../src')
    const outside = readdirSync(srcDir)
      .filter((name) => name.endsWith('.ts'))
      .flatMap((name) => [...readFileSync(path.join(srcDir, name), 'utf8').matchAll(/from '([^']+)'/g)].map((match) => match[1]!).filter((spec) => !spec.startsWith('./') && !spec.startsWith('node:') && spec !== '@godcreator/collab-model/project-model').map((spec) => `${name} → ${spec}`))
    expect(outside).toEqual([])
  })
})
