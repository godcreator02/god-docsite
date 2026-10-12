import { CollabRejected } from '../errors.js'
import { giteaRepo, isGiteaName, limitMergeStyles, protectMain, type Allowance, type GiteaHttp, type GiteaLocation, type MainAllowances, type MainProtection } from './gitea.js'

/*
 * 两种仓共用的规矩：负责人就是协作者（管理权限），不许强制推送，合并方式只留「合并提交」与「仅快进」。
 * main 的推送与合并各许谁写成一个 MainRule，由协作仓与别的仓各自的 rules/ 给；什么时候核对也由它们定
 */

/**
 * 一种仓对 main 的推送与合并许可。'leads' 是只许负责人、不写团队；'nobody' 是谁都不能直接推，负责人的改动也经合并请求进 main；
 * 'executor' 是只许执行器的团队 bots 合并、不写人，负责人也不在许可里
 */
export type MainRule = { push: 'leads' | 'nobody'; merge: 'leads' | 'executor' }

/** 执行器的机器人账号所在的团队；它不算负责人 */
export const botsTeam = 'bots'

/** 照规矩与负责人算出写进 main 保护的许可 */
export function mainAllowancesOf(rule: MainRule, leads: string[]): MainAllowances {
  return {
    push: rule.push === 'nobody' ? null : { users: leads, teams: [] },
    merge: rule.merge === 'executor' ? { users: [], teams: [botsTeam] } : { users: leads, teams: [] },
  }
}

/** 配好以后写进进度的一句：推送与合并各许谁 */
function allowancesSummaryOf(rule: MainRule, leads: string[]): string {
  const push = rule.push === 'nobody' ? '谁都不能直接推送' : `推送只许 ${leads.join('、')}`
  const merge = rule.merge === 'executor' ? `合并只许团队 ${botsTeam}` : `合并只许 ${leads.join('、')}`
  return `${push}，${merge}`
}

const listed = (names: string[]) => (names.length === 0 ? '（没有人）' : names.join('、'))

const sameNames = (a: string[], b: string[]) => a.length === b.length && [...a].sort().join('\n') === [...b].sort().join('\n')

const unrestricted = (doing: string) => `main 的${doing}没有限定人：有写权限的都能${doing}`

function leadsOnlyProblems(doing: string, allowance: Allowance, leads: string[]): string[] {
  if (!allowance.restricted) return [unrestricted(doing)]
  const problems: string[] = []
  if (leads.length > 0 && !sameNames(allowance.users, leads)) problems.push(`main 的${doing}许可里的人是 ${listed(allowance.users)}，负责人是 ${listed(leads)}`)
  if (allowance.teams.length > 0) problems.push(`main 的${doing}许可里写了团队 ${allowance.teams.join('、')}：${doing}只许负责人，不写团队`)
  return problems
}

function nobodyPushesProblems(push: Allowance): string[] {
  if (!push.restricted) return [unrestricted('推送')]
  const allowed = [...push.users, ...push.teams.map((team) => `团队 ${team}`)]
  if (allowed.length === 0) return []
  return [`main 的推送许可里有 ${allowed.join('、')}：这个仓的 main 谁都不能直接推，负责人的改动也经合并请求进 main`]
}

function executorMergesProblems(merge: Allowance): string[] {
  if (!merge.restricted) return [unrestricted('合并')]
  const problems: string[] = []
  if (merge.users.length > 0) problems.push(`main 的合并许可里写了人 ${merge.users.join('、')}：这个仓的 main 只由执行器（团队 ${botsTeam}）合并，负责人也不在许可里`)
  const extraTeams = merge.teams.filter((team) => team !== botsTeam)
  if (extraTeams.length > 0) problems.push(`main 的合并许可里写了团队 ${extraTeams.join('、')}：只许团队 ${botsTeam}`)
  if (!merge.teams.includes(botsTeam)) problems.push(`main 的合并许可里没有团队 ${botsTeam}：执行器合并不了`)
  return problems
}

/** 按规矩核对一个仓，每个问题一句给人看；都对时为空 */
export function setupProblemsOf(leads: string[], protection: MainProtection | null, rule: MainRule): string[] {
  const problems = leads.length === 0 ? ['没有协作者（没有负责人）'] : []
  if (protection === null) return [...problems, 'main 没有分支保护']
  return [
    ...problems,
    ...(rule.push === 'nobody' ? nobodyPushesProblems(protection.push) : leadsOnlyProblems('推送', protection.push, leads)),
    ...(rule.merge === 'executor' ? executorMergesProblems(protection.merge) : leadsOnlyProblems('合并', protection.merge, leads)),
    ...(protection.forcePushAllowed ? ['main 允许强制推送'] : []),
  ]
}

/**
 * 读 Gitea 核对一个仓。只有仓的管理员读得到 main 的保护，还没有 main 的空仓也配不了：这两种回 null（不核对），
 * 别的回问题清单，配好了为空
 */
export async function repoRulesProblemsOf(http: GiteaHttp, location: GiteaLocation, rule: MainRule): Promise<string[] | null> {
  const repository = giteaRepo(http, location.owner, location.repo)
  if (!(await repository.hasMain())) return null
  if (!(await repository.callerIsAdmin())) return null
  const [leads, protection] = await Promise.all([repository.collaborators(), repository.mainProtection()])
  return setupProblemsOf(leads, protection, rule)
}

/** done 里是前面已经做完的；这一步失败时报错写明做到哪一步，那些都不回退。前面什么都没做时原样抛 */
export async function stepAfter(done: string[], doing: string, run: () => Promise<void>): Promise<void> {
  try {
    await run()
  } catch (error) {
    if (!(error instanceof CollabRejected) || done.length === 0) throw error
    throw new CollabRejected(`${done.join('，')}；下一步「${doing}」失败，前面这些不回退：\n${error.message}`)
  }
}

const sameLogin = (a: string, b: string) => a.toLowerCase() === b.toLowerCase()

/**
 * 照规矩配好 Gitea 上的一个仓，依次：合并方式只留「合并提交」与「仅快进」→ 把 leads 都加成协作者（管理）→
 * main 的推送与合并许可照 rule 写、禁止强制推送 → 删掉不在 leads 里的协作者。
 * 删协作者放在最后：调用者自己不在 leads 里时，删了自己就没有管理权限，后面的就改不了。
 * doneBefore 是调用前已经做完的（建仓时写明已建好）；回它加上这里做完的，接着做下一步的调用方失败时照它写明做到哪一步
 */
export async function applyRepoRules(http: GiteaHttp, owner: string, repo: string, leads: string[], rule: MainRule, doneBefore: string[]): Promise<string[]> {
  const done = [...doneBefore]
  const gitea = giteaRepo(http, owner, repo)
  await stepAfter(done, '限定合并方式', () => limitMergeStyles(http, owner, repo))
  done.push(`${done.length === 0 ? `${owner}/${repo} 的` : ''}合并方式已限定为「合并提交」与「仅快进」`)
  for (const lead of leads) {
    await stepAfter(done, `把 ${lead} 加成协作者（管理）`, () => gitea.addAdminCollaborator(lead))
    done.push(`${lead} 已是协作者（管理）`)
  }
  await stepAfter(done, '保护 main', () => protectMain(http, owner, repo, mainAllowancesOf(rule, leads)))
  done.push(`main 已保护（${allowancesSummaryOf(rule, leads)}）`)
  let extras: string[] = []
  await stepAfter(done, '读现有的协作者', async () => {
    extras = (await gitea.collaborators()).filter((login) => !leads.some((lead) => sameLogin(lead, login)))
  })
  for (const login of extras) {
    await stepAfter(done, `把 ${login} 从协作者里删掉`, () => gitea.removeCollaborator(login))
    done.push(`${login} 已不是协作者`)
  }
  return done
}

/** leads 是外部输入：至少一个，每项是 Gitea 用户名，不重复（大小写不论） */
export function requireLeadNames(leads: string[]): void {
  if (leads.length === 0) throw new CollabRejected('leads 不能是空的：至少写一个负责人的 Gitea 用户名')
  const invalid = leads.find((lead) => !isGiteaName(lead))
  if (invalid !== undefined) throw new CollabRejected(`leads 里的 ${JSON.stringify(invalid)} 不是 Gitea 用户名（只含字母、数字与 _ . -）`)
  const repeated = leads.find((lead, index) => leads.findIndex((other) => sameLogin(other, lead)) !== index)
  if (repeated !== undefined) throw new CollabRejected(`leads 里的 ${repeated} 重复了`)
}

/**
 * collab.repo.setup 的共用部分：先核对，还没有 main、调用者（person）不是这个仓的管理员、不给 leads 而现有的协作者也没有，
 * 都拒绝、什么都不改；再照规矩配好（见 applyRepoRules）。回配好之后的负责人。leads 由调用方先用 requireLeadNames 核对过
 */
export async function setUpRepoByRules(http: GiteaHttp, location: GiteaLocation, person: string, leads: string[] | undefined, rule: MainRule): Promise<string[]> {
  const { owner, repo } = location
  const gitea = giteaRepo(http, owner, repo)
  if (!(await gitea.hasMain())) throw new CollabRejected(`${owner}/${repo} 还没有 main 分支，没有改动：先推一个提交到 main 再配`)
  if (!(await gitea.callerIsAdmin())) {
    throw new CollabRejected(`${person} 不是 ${owner}/${repo} 的管理员，没有改动：协作者与分支保护只有这个仓的管理员能改，请它的负责人或组织管理员来配`)
  }
  const chosenLeads = leads ?? (await gitea.collaborators())
  if (chosenLeads.length === 0) throw new CollabRejected(`${owner}/${repo} 还没有协作者（负责人），没有改动：给 leads 写明负责人的 Gitea 用户名`)
  await applyRepoRules(http, owner, repo, chosenLeads, rule, [])
  return chosenLeads
}
