import { beforeEach, describe, expect, it } from 'vitest'
import { OtherReposReview, reviewOtherRepo } from '../../src/other-repos/review.js'
import type { RemoteProject } from '../../src/project/project.js'
import { collaborators, fakeGitea, git, hasMain, localOrganization, noMain, type FakeReply, type LocalOrganization } from '../fixtures/local-organization.js'

const datasheets = { owner: 'hybrid-mmc', repo: 'datasheets', ownerUrl: 'https://git.example.org/hybrid-mmc' }
const base = '/repos/hybrid-mmc/datasheets'
const web = 'https://git.example.org/hybrid-mmc/datasheets'

const pull = (number: number, poster: string, baseRef = 'main') => ({ number, title: `#${number}`, user: { login: poster }, base: { ref: baseRef }, html_url: `${web}/pulls/${number}` })
const issue = (number: number, poster: string, comments: number) => ({ number, title: `#${number}`, user: { login: poster }, html_url: `${web}/issues/${number}`, comments, state: 'open', pull_request: null })
const comments = (...authors: string[]): FakeReply => ({ status: 200, body: authors.map((author, index) => ({ id: index + 1, body: '…', user: { login: author } })) })
const reviews = (...entries: Array<[string, string, boolean?]>): FakeReply => ({
  status: 200,
  body: entries.map(([reviewer, state, dismissed], index) => ({ id: index + 1, user: { login: reviewer }, state, dismissed: dismissed ?? false })),
})
const list = (items: unknown[]): FakeReply => ({ status: 200, body: items })

describe('读一个别的仓', () => {
  it('我是负责人：列出别人开的、合到 main 的合并请求，和最后发言的不是负责人的 issue；自己开的、合到别的分支的不列', async () => {
    const { http } = fakeGitea({
      [`GET ${base}/collaborators`]: collaborators('bob', 'admin'),
      [`GET ${base}/branches/main`]: hasMain,
      [`GET ${base}/pulls`]: list([pull(3, 'carol'), pull(5, 'carol', 'dev')]),
      [`GET ${base}/issues`]: list([issue(7, 'carol', 0), issue(8, 'carol', 2), issue(9, 'dave', 1)]),
      [`GET ${base}/issues/8/comments`]: comments('carol', 'admin'),
      [`GET ${base}/issues/9/comments`]: comments('carol'),
    })
    expect(await reviewOtherRepo(http, datasheets, 'bob')).toEqual({
      repo: 'datasheets',
      pullsToReview: [{ repo: 'datasheets', number: 3, title: '#3', poster: 'carol', url: `${web}/pulls/3` }],
      issuesToAnswer: [
        { repo: 'datasheets', number: 7, title: '#7', poster: 'carol', lastSpeaker: 'carol', url: `${web}/issues/7` },
        { repo: 'datasheets', number: 9, title: '#9', poster: 'dave', lastSpeaker: 'carol', url: `${web}/issues/9` },
      ],
      myPullUpdates: [],
      myIssuesAnswered: [],
    })
  })

  it('我不是负责人：不列等审阅的合并请求、不列轮到负责人回的 issue，也不去读别人 issue 的评论', async () => {
    const { http, sent } = fakeGitea({
      [`GET ${base}/collaborators`]: collaborators('admin'),
      [`GET ${base}/branches/main`]: hasMain,
      [`GET ${base}/pulls`]: list([pull(3, 'carol')]),
      [`GET ${base}/issues`]: list([issue(8, 'carol', 2)]),
    })
    expect(await reviewOtherRepo(http, datasheets, 'bob')).toMatchObject({ pullsToReview: [], issuesToAnswer: [] })
    expect(sent()).not.toContain(`GET ${base}/issues/8/comments`)
  })

  it('我开的合并请求：最新的有效审阅要求修改就是 changes-requested；撤销了的、只是评论的审阅不算；后来批准了就看评论', async () => {
    const http = (reviewReply: FakeReply, commentReply: FakeReply) =>
      fakeGitea({
        [`GET ${base}/collaborators`]: collaborators('admin'),
        [`GET ${base}/branches/main`]: hasMain,
        [`GET ${base}/pulls`]: list([pull(4, 'bob')]),
        [`GET ${base}/issues`]: list([]),
        [`GET ${base}/pulls/4/reviews`]: reviewReply,
        [`GET ${base}/issues/4/comments`]: commentReply,
      }).http
    const update = { repo: 'datasheets', number: 4, title: '#4', url: `${web}/pulls/4` }
    expect((await reviewOtherRepo(http(reviews(['admin', 'REQUEST_CHANGES'], ['carol', 'COMMENT']), comments('bob')), datasheets, 'bob')).myPullUpdates).toEqual([
      { ...update, change: 'changes-requested', by: 'admin' },
    ])
    expect((await reviewOtherRepo(http(reviews(['admin', 'REQUEST_CHANGES', true]), comments('bob')), datasheets, 'bob')).myPullUpdates).toEqual([])
    expect((await reviewOtherRepo(http(reviews(['admin', 'REQUEST_CHANGES'], ['admin', 'APPROVED']), comments('bob')), datasheets, 'bob')).myPullUpdates).toEqual([])
  })

  it('我开的合并请求：最后一条评论不是我就是 new-comment；我回过了、没有评论都不列', async () => {
    const http = (commentReply: FakeReply) =>
      fakeGitea({
        [`GET ${base}/collaborators`]: collaborators('admin'),
        [`GET ${base}/branches/main`]: hasMain,
        [`GET ${base}/pulls`]: list([pull(4, 'bob'), pull(6, 'bob', 'dev')]),
        [`GET ${base}/issues`]: list([]),
        [`GET ${base}/pulls/4/reviews`]: reviews(),
        [`GET ${base}/issues/4/comments`]: commentReply,
      }).http
    expect((await reviewOtherRepo(http(comments('bob', 'carol')), datasheets, 'bob')).myPullUpdates).toEqual([
      { repo: 'datasheets', number: 4, title: '#4', change: 'new-comment', by: 'carol', url: `${web}/pulls/4` },
    ])
    expect((await reviewOtherRepo(http(comments('carol', 'bob')), datasheets, 'bob')).myPullUpdates).toEqual([])
    expect((await reviewOtherRepo(http(comments()), datasheets, 'bob')).myPullUpdates).toEqual([])
  })

  it('我提的 issue：最后发言的是这个仓的负责人、又不是我就列出来；别人回的、我自己最后说的不列', async () => {
    const { http } = fakeGitea({
      [`GET ${base}/collaborators`]: collaborators('admin', 'bob'),
      [`GET ${base}/branches/main`]: hasMain,
      [`GET ${base}/pulls`]: list([]),
      [`GET ${base}/issues`]: list([issue(11, 'bob', 1), issue(12, 'bob', 1), issue(13, 'bob', 2)]),
      [`GET ${base}/issues/11/comments`]: comments('admin'),
      [`GET ${base}/issues/12/comments`]: comments('carol'),
      [`GET ${base}/issues/13/comments`]: comments('admin', 'bob'),
    })
    const review = await reviewOtherRepo(http, datasheets, 'bob')
    expect(review.myIssuesAnswered).toEqual([{ repo: 'datasheets', number: 11, title: '#11', by: 'admin', url: `${web}/issues/11` }])
    expect(review.issuesToAnswer.map((each) => each.number)).toEqual([12])
  })

  it('还没有 main 的空仓：没有合并请求，不去列', async () => {
    const { http, sent } = fakeGitea({ [`GET ${base}/collaborators`]: collaborators('bob'), [`GET ${base}/branches/main`]: noMain, [`GET ${base}/issues`]: list([]) })
    expect(await reviewOtherRepo(http, datasheets, 'bob')).toEqual({ repo: 'datasheets', pullsToReview: [], issuesToAnswer: [], myPullUpdates: [], myIssuesAnswered: [] })
    expect(sent()).not.toContain(`GET ${base}/pulls`)
  })
})

let organization: LocalOrganization
let bob: RemoteProject

/** 每个仓都有 main，我（bob）是负责人，各有一个别人开的合并请求 */
function giteaWithPulls(pullsOf: Record<string, number[]>) {
  const replies = Object.fromEntries(
    Object.entries(pullsOf).flatMap(([repo, numbers]) => [
      [`GET /repos/hybrid-mmc/${repo}/collaborators`, collaborators('bob')],
      [`GET /repos/hybrid-mmc/${repo}/branches/main`, hasMain],
      [`GET /repos/hybrid-mmc/${repo}/issues`, { status: 200, body: [] }],
      [
        `GET /repos/hybrid-mmc/${repo}/pulls`,
        { status: 200, body: numbers.map((number) => ({ number, title: `#${number}`, user: { login: 'carol' }, base: { ref: 'main' }, html_url: `https://git.example.org/hybrid-mmc/${repo}/pulls/${number}` })) },
      ],
    ]),
  )
  return fakeGitea(replies)
}

describe('各项目里别的仓读到的', () => {
  beforeEach(async () => {
    organization = await localOrganization({ datasheets: { 'README.md': '资料库\n' }, firmware: { 'main.c': '\n' } })
    bob = await organization.bob()
    for (const name of ['datasheets', 'firmware']) git(organization.dirOf(name), 'remote', 'set-url', 'origin', `https://git.example.org/hybrid-mmc/${name}.git`)
  })

  it('按目录名记，位置从仓的 origin 读；重读一个仓只换掉那一个，内容一样不报变化', async () => {
    const changed: string[] = []
    const pulls: Record<string, number[]> = { datasheets: [3], firmware: [5] }
    const review = new OtherReposReview(giteaWithPulls(pulls).http, (repo) => changed.push(repo))
    await review.review(bob, 'datasheets')
    await review.review(bob, 'firmware')
    expect(review.reviewsOf(bob.repo).map((each) => [each.repo, each.pullsToReview.map((pull) => pull.number)])).toEqual([
      ['datasheets', [3]],
      ['firmware', [5]],
    ])
    expect(changed).toHaveLength(2)
    await review.review(bob, 'firmware')
    expect(changed).toHaveLength(2)
  })

  it('完整刷新以后只留还在项目文件夹里的仓；忘掉以后什么都没有', async () => {
    const changed: string[] = []
    const review = new OtherReposReview(giteaWithPulls({ datasheets: [3], firmware: [5] }).http, (repo) => changed.push(repo))
    await review.review(bob, 'datasheets')
    await review.review(bob, 'firmware')
    review.retainOnly(bob.repo, ['firmware'])
    expect(review.reviewsOf(bob.repo).map((each) => each.repo)).toEqual(['firmware'])
    expect(changed).toHaveLength(3)
    review.forget(bob.repo)
    expect(review.reviewsOf(bob.repo)).toEqual([])
  })
})
