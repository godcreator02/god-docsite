import { describe, expect, it } from 'vitest'
import { peoplePathInRepo } from '../src/core/layout.js'
import { check, commit, git, people, write, writePeople } from './merge-check-repo.js'

describe('合并检查：只有负责人能改的内容', () => {
  it('成员改了工作流、人员列表、装包设置、Node 会执行的配置、scripts、框架包版本、写成网址的依赖：只有负责人能改，逐处写明', async () => {
    write(
      'site/package.json',
      `${JSON.stringify({ scripts: { dev: 'vite' }, dependencies: { react: '^19.3.0', '@godcreator/collab': '^0.1.0', evil: 'https://example.org/evil.tgz' } }, null, 2)}\n`,
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
        'site/package.json 的 scripts、site/package.json 里 @godcreator/collab 的版本、site/package.json 里 evil 写成了 "https://example.org/evil.tgz"（只能写版本号范围）、' +
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
    write('site/people.json', `${JSON.stringify([...(JSON.parse(people) as unknown[]), { id: 'bob2', name: '乙二', gitea: 'bob' }], null, 2)}\n`)
    commit('加一项')
    expect((await check('topic')).verdict).toBe('needs-review')
  })

  it('人员列表按布局在 site/people.json：改了别人那一项要负责人，写在 collab/ 下的 people.json 不是人员列表、不按它挡', async () => {
    expect(peoplePathInRepo).toBe('site/people.json')
    writePeople((person) => (person.gitea === 'alice' ? { ...person, name: '甲改名' } : person))
    commit('乙改了甲的名字')
    expect((await check('topic')).problems).toEqual([`改了只有负责人能改的内容：${peoplePathInRepo}；这类改动交给负责人（协作仓的协作者）提交`])
    git('checkout', '-q', '-B', 'topic', 'main')
    write('collab/people.json', people.replace('乙', '乙改名'))
    commit('乙在 collab/ 下放了一份 people.json')
    expect(await check('topic')).toEqual({ verdict: 'mergeable', problems: [] })
  })

  it('site/package.json 里 @godcreator/ 下的包都只有负责人能改：平台、身份、评论加进来逐个写明，两段依赖都看', async () => {
    const dependencies = { react: '^19.3.0', '@godcreator/identity': '^0.1.0', '@godcreator/god-docsite': '^0.1.0' }
    write('site/package.json', `${JSON.stringify({ dependencies, devDependencies: { '@godcreator/comments': '^0.1.0' } }, null, 2)}\n`)
    commit('乙给站点加了平台与身份、评论包')
    expect((await check('topic')).problems).toEqual([
      '改了只有负责人能改的内容：site/package.json 里 @godcreator/god-docsite 的版本、site/package.json 里 @godcreator/identity 的版本、' +
        'site/package.json 里 @godcreator/comments 的版本；这类改动交给负责人（协作仓的协作者）提交',
    ])
  })

  it('站点已经装着 @godcreator/ 的包：改其中一个的版本、删掉一个都要负责人；只升级别的库、加别的库放开', async () => {
    const siteDependencies = { react: '^19.3.0', '@godcreator/god-docsite': '^0.1.0', '@godcreator/identity': '^0.1.0', '@godcreator/comments': '^0.1.0', '@godcreator/collab': '^0.1.0' }
    const writeSitePackage = (dependencies: Record<string, string>) => write('site/package.json', `${JSON.stringify({ dependencies }, null, 2)}\n`)
    git('checkout', '-q', 'main')
    writeSitePackage(siteDependencies)
    commit('甲建站')
    const attempts: Array<[string, Record<string, string>, string[]]> = [
      ['升级评论包', { ...siteDependencies, '@godcreator/comments': '^0.2.0' }, ['site/package.json 里 @godcreator/comments 的版本']],
      ['删掉身份包', Object.fromEntries(Object.entries(siteDependencies).filter(([name]) => name !== '@godcreator/identity')), ['site/package.json 里 @godcreator/identity 的版本']],
      ['平台包写成本地路径', { ...siteDependencies, '@godcreator/god-docsite': 'file:../god-docsite' }, ['site/package.json 里 @godcreator/god-docsite 的版本', 'site/package.json 里 @godcreator/god-docsite 写成了 "file:../god-docsite"（只能写版本号范围）']],
    ]
    for (const [message, dependencies, changes] of attempts) {
      git('checkout', '-q', '-B', 'topic', 'main')
      writeSitePackage(dependencies)
      commit(message)
      expect((await check('topic')).problems, message).toEqual([`改了只有负责人能改的内容：${changes.join('、')}；这类改动交给负责人（协作仓的协作者）提交`])
    }
    git('checkout', '-q', '-B', 'topic', 'main')
    writeSitePackage({ ...siteDependencies, react: '^19.4.0', three: '^0.186.0' })
    commit('乙升级 react、加 three')
    expect(await check('topic')).toEqual({ verdict: 'mergeable', problems: [] })
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
