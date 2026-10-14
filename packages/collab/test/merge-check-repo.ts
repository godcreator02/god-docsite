import { execFileSync } from 'node:child_process'
import { appendFileSync, mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { beforeEach } from 'vitest'
import { checkMerge } from '../src/check.js'

/** 各主题测试文件共用的建仓夹具（原 check.test.ts 的 beforeEach 与辅助，原样搬来）；repo 经 ESM live binding 在 beforeEach 赋值后对各文件生效 */

export const people = `${JSON.stringify(
  [
    { id: 'alice', name: '甲', codes: ['alicecode001'], gitea: 'alice' },
    { id: 'bob', name: '乙', gitea: 'bob' },
  ],
  null,
  2,
)}\n`

/** 合并检查不解码记录，记录文件写成什么样都行；这里照记录的样子写，一个字段一行 */
export const taskText = (id: string, author: string, title: string) => `${JSON.stringify({ id, type: 'task', author, status: 'todo', title }, null, 2)}\n`
export const aliceTaskId = '20260930100000-aaaaaaa'
export const bobTaskId = '20260930110000-bbbbbbb'
export const laterTaskId = '20260930120000-ccccccc'

export let repo: string
export const git = (...args: string[]) => execFileSync('git', args, { cwd: repo, encoding: 'utf8' })

export function write(relative: string, content: string) {
  const file = path.join(repo, relative)
  mkdirSync(path.dirname(file), { recursive: true })
  writeFileSync(file, content)
}

export const writeTask = (id: string, author: string, title: string) => write(`collab/records/${id}.json`, taskText(id, author, title))

export function commit(message: string) {
  git('add', '-A')
  git('commit', '-q', '-m', message)
  return git('rev-parse', 'HEAD').trim()
}

/** main 上有人员列表与甲的一条任务；topic 分支从这里分出（不叫 head：Windows 上它和 HEAD 是同一个引用） */
/*
 * main 上的起点提交只在每个测试进程里现建一次（模板仓），每个用例本地 clone 它（git 对本地克隆
 * 用硬链接共享对象，毫秒级）再从 main 分出 topic：每用例从 init+config×3+commit+checkout 共 6 次
 * git 降到 clone+checkout 2 次；clone 不带模板的本地配置，user 与换行配置直接写进 .git/config。
 */
let templateRepo: string | undefined

beforeEach(() => {
  if (templateRepo === undefined) {
    templateRepo = mkdtempSync(path.join(tmpdir(), 'collab-merge-template-'))
    const run = (...args: string[]) => execFileSync('git', args, { cwd: templateRepo, encoding: 'utf8' })
    const writeIn = (relative: string, content: string) => {
      const file = path.join(templateRepo!, relative)
      mkdirSync(path.dirname(file), { recursive: true })
      writeFileSync(file, content)
    }
    run('init', '-q', '-b', 'main')
    writeIn('site/people.json', people)
    writeIn(`collab/records/${aliceTaskId}.json`, taskText(aliceTaskId, 'alice', '画子模块板原理图'))
    writeIn('site/package.json', `${JSON.stringify({ dependencies: { react: '^19.3.0' } }, null, 2)}\n`)
    writeIn('site/pages/home/page.mdx', '# 首页\n')
    run('add', '-A')
    run('-c', 'user.name=probe', '-c', 'user.email=probe@local', 'commit', '-q', '-m', 'base')
  }
  repo = mkdtempSync(path.join(tmpdir(), 'collab-merge-'))
  execFileSync('git', ['clone', '-q', templateRepo, repo], { encoding: 'utf8' })
  appendFileSync(path.join(repo, '.git', 'config'), '[user]\n\tname = probe\n\temail = probe@local\n[core]\n\tautocrlf = false\n')
  git('checkout', '-q', '-b', 'topic')
})

/** author 为 null 时不说提交的人是谁 */
export const check = (head = 'topic', authorIsLead = false, author: string | null = 'bob') =>
  checkMerge({ repo, base: 'main', head, collabPathInRepo: 'collab', sitePathInRepo: 'site', authorIsLead, ...(author === null ? {} : { author }) })

/** 人员列表改一处：按 id 找到那一项，换成 change 算出的样子 */
export function writePeople(change: (person: Record<string, unknown>) => Record<string, unknown>) {
  const list = JSON.parse(people) as Array<Record<string, unknown>>
  write('site/people.json', `${JSON.stringify(list.map(change), null, 2)}\n`)
}
