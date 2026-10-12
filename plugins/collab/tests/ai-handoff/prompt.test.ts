import { notificationKinds, notificationOf, type NotificationFacts, type NotificationKind } from '@godcreator/collab-model/notification-model'
import { describe, expect, it } from 'vitest'
import { aiHandlingModeOf, aiPromptOf } from '../../src/ai-handoff/prompt.js'

describe('aiHandlingModeOf', () => {
  it('只认 off / zcode / claude-terminal，别的直接报错', () => {
    expect(aiHandlingModeOf('off')).toBe('off')
    expect(aiHandlingModeOf('zcode')).toBe('zcode')
    expect(aiHandlingModeOf('claude-terminal')).toBe('claude-terminal')
    expect(() => aiHandlingModeOf('ZCode')).toThrow('只能是 off / zcode / claude-terminal')
    expect(() => aiHandlingModeOf(undefined)).toThrow('读到 undefined')
  })
})

const project = { title: '混合型 MMC', repo: 'D:/projects/hybrid-mmc/collab' }
const nameOf = (personId: string) => ({ carol: '卡萝', admin: '管理员' })[personId] ?? personId

/** 每种 kind 一条事实，用来逐种核对指到哪个附件 */
const factsOfKind = {
  unsubmitted: { kind: 'unsubmitted', records: ['records/a.json'], siteFiles: [] },
  conflicts: { kind: 'conflicts', files: ['site/content/a.mdx'] },
  'submit-failure': { kind: 'submit-failure', message: '执行器打回', at: '2026-10-08T10:00:00Z' },
  'sync-problem': { kind: 'sync-problem', reason: '改动碰到同一个文件' },
  'check-error': { kind: 'check-error', message: '连不上 Gitea' },
  'off-main': { kind: 'off-main', branch: 'draft' },
  'record-problem': { kind: 'record-problem', file: 'records/b.json', message: '不是合法 JSON' },
  'webhook-setup': { kind: 'webhook-setup', organization: 'hybrid-mmc', problems: ['少了事件 pull_request_review'] },
  unpushed: { kind: 'unpushed', repo: 'firmware', count: 1 },
  unpulled: { kind: 'unpulled', repo: 'firmware', count: 2 },
  diverged: { kind: 'diverged', repo: 'firmware', ahead: 1, behind: 2 },
  'pull-to-review': { kind: 'pull-to-review', repo: 'datasheets', number: 3, title: '补手册', poster: 'carol', url: 'https://git.example.org/hybrid-mmc/datasheets/pulls/3' },
  'issue-to-answer': { kind: 'issue-to-answer', repo: 'datasheets', number: 9, title: '缺页', poster: 'carol', lastSpeaker: 'carol', url: 'https://git.example.org/hybrid-mmc/datasheets/issues/9' },
  'my-pull-update': { kind: 'my-pull-update', repo: 'datasheets', number: 4, title: '改目录', change: 'changes-requested', by: 'admin', url: 'https://git.example.org/hybrid-mmc/datasheets/pulls/4' },
  'my-issue-answered': { kind: 'my-issue-answered', repo: 'datasheets', number: 11, title: '要新版', by: 'admin', url: 'https://git.example.org/hybrid-mmc/datasheets/issues/11' },
  'repo-setup': { kind: 'repo-setup', repo: 'firmware', problems: ['main 没有分支保护'] },
  task: { kind: 'task', recordId: 't1', title: '核算纹波', due: '2026-10-10', detail: '按新参数' },
  mention: { kind: 'mention', comment: '2026-10-10-a/index.mdx', author: 'carol', page: '/plan?comment=2026-10-10-a', text: '@bob 看看', in: 'comment' },
  reply: { kind: 'reply', comment: '2026-10-10-a/r1.mdx', author: 'carol', page: '/plan?comment=2026-10-10-a', text: '改好了', threadId: '2026-10-10-a' },
} satisfies { [K in NotificationKind]: Extract<NotificationFacts, { kind: K }> }

const expectedHandling: Record<NotificationKind, string> = {
  unsubmitted: 'references/collab-repo.md 的「通知」',
  conflicts: 'references/collab-repo.md 的「通知」',
  'submit-failure': 'references/collab-repo.md 的「通知」',
  'sync-problem': 'references/collab-repo.md 的「通知」',
  'check-error': 'references/collab-repo.md 的「通知」',
  'off-main': 'references/collab-repo.md 的「通知」',
  'record-problem': 'references/collab-repo.md 的「通知」',
  'webhook-setup': 'references/organization.md 的「组织 webhook」',
  unpushed: 'references/other-repos.md 的「通知」',
  unpulled: 'references/other-repos.md 的「通知」',
  diverged: 'references/other-repos.md 的「通知」',
  'pull-to-review': 'references/other-repos.md 的「通知」',
  'issue-to-answer': 'references/other-repos.md 的「通知」',
  'my-pull-update': 'references/other-repos.md 的「通知」',
  'my-issue-answered': 'references/other-repos.md 的「通知」',
  'repo-setup': 'references/other-repos.md 的「通知」',
  task: 'references/collab-repo.md 的「通知」',
  mention: 'references/collab-repo.md 的「通知」',
  reply: 'references/collab-repo.md 的「通知」',
}

const readMain = 'run skill.read {"name":"collab"}'
const readOf = (file: string) => `run skill.read {"name":"collab","file":"${file}"}`

describe('交给 AI 的提示词', () => {
  it('没有通知就拒绝', () => {
    expect(() => aiPromptOf(project, [], nameOf)).toThrow('混合型 MMC 现在没有要处理的事，没有交给 AI')
  })

  it('一条通知：第一行就是那件事；写组、短句、该照哪一节处理与原文，只让读主文件和用到的那个附件', () => {
    const prompt = aiPromptOf(project, [notificationOf({ kind: 'record-problem', file: 'records/b.json', message: '不是合法 JSON' })], nameOf)
    expect(prompt.split('\n')[0]).toBe('协作站要处理的事（混合型 MMC）：collab/records/b.json 读不对')
    expect(prompt).toContain(`${readMain}\n${readOf('references/collab-repo.md')}\n人同意以后照说明书用 collab.* 命令做事，命令的 repo 参数填上面的协作仓路径。`)
    expect(prompt).toContain('1. 【协作仓】collab/records/b.json 读不对\n   照说明书 collab 的附件 references/collab-repo.md 的「通知」一节处理。\n   原文：\n   > 不是合法 JSON')
    expect(prompt).not.toContain('references/other-repos.md')
    expect(prompt).not.toContain('references/organization.md')
    expect(prompt.trimEnd().endsWith('照说明书主文件的「始终照做」。')).toBe(true)
  })

  it.each(notificationKinds)('%s 指到说明书里写着它的那一节', (kind) => {
    const prompt = aiPromptOf(project, [notificationOf(factsOfKind[kind])], nameOf)
    expect(prompt).toContain(`   照说明书 collab 的附件 ${expectedHandling[kind]}一节处理。`)
  })

  it('用到几个附件就让读几个，按第一次用到的顺序、不重复；没有原文的通知不写原文', () => {
    const prompt = aiPromptOf(
      project,
      [
        notificationOf(factsOfKind['webhook-setup']),
        notificationOf(factsOfKind.unpulled),
        notificationOf(factsOfKind['pull-to-review']),
        notificationOf(factsOfKind.reply),
      ],
      nameOf,
    )
    expect(prompt.split('\n')[0]).toBe('协作站要处理的 4 件事（混合型 MMC）')
    expect(prompt).toContain(`${readMain}\n${readOf('references/organization.md')}\n${readOf('references/other-repos.md')}\n${readOf('references/collab-repo.md')}\n人同意以后照说明书`)
    expect(prompt.split(readOf('references/other-repos.md')).length).toBe(2)
    expect(prompt).toContain('2. 【别的仓】firmware 服务器上有 2 个新提交还没拉下来\n   照说明书 collab 的附件 references/other-repos.md 的「通知」一节处理。\n\n3.')
  })

  it('读说明书之前就写明这一轮只读和整理：列出打算怎么处理、停下等人，同意之前不改文件、不调会改东西的命令；结尾再说一遍', () => {
    const prompt = aiPromptOf(project, [notificationOf(factsOfKind.task)], nameOf)
    const ruleAt = prompt.indexOf('这一轮只读和整理，不动手：')
    expect(ruleAt).toBeGreaterThan(prompt.indexOf(`协作仓：${project.repo}`))
    expect(ruleAt).toBeLessThan(prompt.indexOf(readMain))
    expect(prompt).toContain('逐条列出打算怎么处理：改哪些文件、调哪些命令。\n- 列完就停下，等人回复。')
    expect(prompt).toContain(
      '人明确同意之前，不改任何文件，也不调任何会改东西的命令：collab.submit、collab.task.*、collab.module.*、docsite.comment.*、collab.repos.update、collab.org.setup、gitea.http 的写请求（POST、PUT、PATCH、DELETE）、git commit、git push 都算。',
    )
    expect(prompt).toContain('人只同意了其中几条，就只做那几条。')
    expect(prompt.trimEnd().split('\n').slice(-2)).toEqual([
      '再说一遍：先列出每条打算怎么处理，然后停下等人回复；人明确同意之前不改文件、不调会改东西的命令。',
      '照说明书主文件的「始终照做」。',
    ])
  })

  it('每条通知只指到说明书的一节，不写处理办法、旧附件名与抄来的规矩', () => {
    const prompt = aiPromptOf(project, notificationKinds.map((kind) => notificationOf(factsOfKind[kind])), nameOf)
    const notificationBlocks = prompt.slice(prompt.indexOf('要处理的事：'), prompt.indexOf('再说一遍：'))
    for (const oldName of ['daily.md', 'project.md', 'references/repos.md']) expect(prompt).not.toContain(oldName)
    for (const command of ['collab.submit', 'collab.repos.update', 'collab.repo.setup', 'collab.org.setup', 'gitea.http']) expect(notificationBlocks).not.toContain(command)
    expect(prompt).not.toContain('规矩：')
  })
})
