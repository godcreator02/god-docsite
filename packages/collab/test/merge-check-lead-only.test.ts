import { describe, expect, it } from 'vitest'
import { check, commit, git, people, write, writePeople } from './repo.js'

describe('合并检查：只有负责人能改的内容', () => {
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
})
