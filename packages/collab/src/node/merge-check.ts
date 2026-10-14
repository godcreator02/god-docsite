import { execFile } from 'node:child_process'
import path from 'node:path'
import { promisify } from 'node:util'
import { peoplePathInRepo, sitePathInRepo } from '../core/layout.js'

/** mergeable 能合并；conflict 和 base 有冲突；needs-review 改了只有负责人能改的内容、提交的人又不是负责人 */
export type MergeVerdict = 'mergeable' | 'conflict' | 'needs-review'

/** problems 是不满足的条目，给人看的原话；能合并时为空 */
export type MergeCheck = { verdict: MergeVerdict; problems: string[] }

/**
 * 仓的布局按 core/layout 固定：站点在 site/，人员列表是 site/people.json。
 * authorIsLead：提交合并请求的人是不是协作仓的负责人（Gitea 上协作仓的协作者），是就放行只有负责人能改的内容。
 * author：提交合并请求的人的 Gitea 用户名；给了就放行他只给人员列表里自己那一项（gitea 是他）加减身份码
 */
export type MergeCheckRequest = { repo: string; base: string; head: string; authorIsLead: boolean; author?: string }

const execFileAsync = promisify(execFile)

/** 运行一条 git 命令：退出码不是 0 不算异常，由调用方按退出码判断；git 启动不了才抛错 */
async function runGit(repo: string, args: string[]): Promise<{ code: number; stdout: string; stderr: string }> {
  try {
    const { stdout, stderr } = await execFileAsync('git', args, { cwd: repo, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 })
    return { code: 0, stdout, stderr }
  } catch (error) {
    const failed = error as { code?: unknown; stdout?: string; stderr?: string }
    if (typeof failed.code !== 'number') throw error
    return { code: failed.code, stdout: failed.stdout ?? '', stderr: failed.stderr ?? '' }
  }
}

/** 运行一条 git 命令，回它的输出；退出码不是 0 就把 git 的原话报出来 */
export async function git(repo: string, args: string[]): Promise<string> {
  const output = await runGit(repo, args)
  if (output.code !== 0) throw new Error(`git ${args.join(' ')} 失败${output.stderr.trim() ? `：${output.stderr.trim()}` : ''}`)
  return output.stdout
}

/** base 与 head（提交或树）之间改了的文件，相对仓根 */
export async function changedFilesBetween(repo: string, base: string, head: string): Promise<string[]> {
  return (await git(repo, ['diff', '--name-only', '-z', base, head])).split('\0').filter((file) => file !== '')
}

/** 站点依赖里写着功能包的那一项：它决定每个人电脑上运行的网站代码，也决定站点协议号对不对得上插件 */
const frameworkPackage = '@godcreator/collab-site'

const dependencySections = ['dependencies', 'devDependencies'] as const

const isPlainObject = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value)

/** 普通的版本号范围：不带网址、git 地址、本地路径、别名这类协议（它们都有 : / # \ 之一），装包只走源 */
const isVersionRange = (spec: unknown) => typeof spec === 'string' && spec.trim() !== '' && !/[:/#\\]/.test(spec)

/**
 * 只看改了的文件名就能判定的：执行器工作流（改了能绕过检查、拿到组织密钥）、
 * 站点的装包设置（从哪个源装 @godcreator 的包、哪些包能运行安装脚本）、站点根目录下 Node 会执行的配置文件。
 * 人员列表 site/people.json 另由 peopleChangeIsOwnCodesOnly 判断
 */
function isLeadOnlyFile(file: string): boolean {
  if (file.startsWith('.gitea/') || file.startsWith('.github/')) return true
  if (file === `${sitePathInRepo}/.npmrc` || file === `${sitePathInRepo}/pnpm-workspace.yaml`) return true
  if (path.posix.dirname(file) !== sitePathInRepo) return false
  const name = path.posix.basename(file)
  return /\.config\.[cm]?[jt]s$/.test(name) || name.startsWith('.postcssrc')
}

/** 那个版本上的 package.json；没有这个文件、或不是 JSON 对象（看不出改了哪几处）为 null */
async function packageJsonAt(repo: string, revision: string, file: string): Promise<Record<string, unknown> | null> {
  const shown = await runGit(repo, ['show', `${revision}:${file}`])
  if (shown.code !== 0) return null
  let parsed: unknown
  try {
    parsed = JSON.parse(shown.stdout)
  } catch (error) {
    if (!(error instanceof SyntaxError)) throw error
    return null
  }
  return isPlainObject(parsed) ? parsed : null
}

function sectionOf(packageJson: Record<string, unknown>, section: string): Record<string, unknown> {
  const value = packageJson[section]
  return isPlainObject(value) ? value : {}
}

/**
 * site/package.json 里只有负责人能改的那几处：依赖两段以外的键（scripts 等，插件在每个人电脑上运行 pnpm dev）、
 * 功能包那一项、写成网址或本地路径的依赖。加库、升级库、删库放开。文件新建、删掉或读不懂时整个算
 */
async function packageJsonChanges(repo: string, base: string, head: string, file: string): Promise<string[]> {
  const [before, after] = await Promise.all([packageJsonAt(repo, base, file), packageJsonAt(repo, head, file)])
  if (before === null || after === null) return [file]
  const changes: string[] = []
  const keys = new Set([...Object.keys(before), ...Object.keys(after)])
  for (const key of [...keys].sort()) {
    if ((dependencySections as readonly string[]).includes(key)) continue
    if (JSON.stringify(before[key]) !== JSON.stringify(after[key])) changes.push(`${file} 的 ${key}`)
  }
  for (const section of dependencySections) {
    const [old, now] = [sectionOf(before, section), sectionOf(after, section)]
    if (old[frameworkPackage] !== now[frameworkPackage]) changes.push(`${file} 里 ${frameworkPackage} 的版本`)
    for (const [name, spec] of Object.entries(now)) {
      if (old[name] !== spec && !isVersionRange(spec)) changes.push(`${file} 里 ${name} 写成了 ${JSON.stringify(spec)}（只能写版本号范围）`)
    }
  }
  return changes
}

/** 那个版本上的 JSON 文件；没有这个文件、或不是 JSON 为 null */
async function jsonAt(repo: string, revision: string, file: string): Promise<unknown> {
  const shown = await runGit(repo, ['show', `${revision}:${file}`])
  if (shown.code !== 0) return null
  try {
    return JSON.parse(shown.stdout)
  } catch (error) {
    if (!(error instanceof SyntaxError)) throw error
    return null
  }
}

const withoutCodes = ({ codes: _codes, ...rest }: Record<string, unknown>) => rest

/**
 * 人员列表的改动只是 author 给自己那一项（gitea 是 author）加减身份码：成员第一次在本机用协作站时，
 * gwb-collab 把本机的身份码写进他那一项。项数、先后、别的字段、别人的项都不变才算；读不懂也不算
 */
async function peopleChangeIsOwnCodesOnly(repo: string, base: string, head: string, file: string, author: string): Promise<boolean> {
  const [before, after] = await Promise.all([jsonAt(repo, base, file), jsonAt(repo, head, file)])
  if (!Array.isArray(before) || !Array.isArray(after) || before.length !== after.length) return false
  return before.every((old, index) => {
    const now: unknown = after[index]
    if (!isPlainObject(old) || !isPlainObject(now)) return false
    if (JSON.stringify(old) === JSON.stringify(now)) return true
    return old.gitea === author && now.gitea === author && JSON.stringify(withoutCodes(old)) === JSON.stringify(withoutCodes(now))
  })
}

/** base 到 head（提交或树）之间只有负责人能改的改动，每条是给人看的一处；没有为空。changedFiles 是 base 与 head 之间改了的文件（相对仓根），调用方已算好 */
async function leadOnlyChangesBetween(request: MergeCheckRequest & { changedFiles: readonly string[] }): Promise<string[]> {
  const { repo, base, head, author, changedFiles } = request
  const changes: string[] = []
  for (const file of changedFiles) {
    if (file === `${sitePathInRepo}/package.json`) changes.push(...(await packageJsonChanges(repo, base, head, file)))
    else if (file === peoplePathInRepo) {
      if (author === undefined || !(await peopleChangeIsOwnCodesOnly(repo, base, head, file, author))) changes.push(file)
    } else if (isLeadOnlyFile(file)) changes.push(file)
  }
  return changes
}

/**
 * 合并检查的第二条，gwb-collab 推送前在本机也按它查：有只有负责人能改的改动、提交的人又不是负责人，回一句给人看的原话；
 * 没有或提交的人是负责人时为空。authorIsLead 由调用方按 Gitea 上协作仓的协作者算好交来，
 * changedFiles 是 base 与 head 之间改了的文件（相对仓根），调用方用 changedFilesBetween 算好交来，这里不再自己算一遍
 */
export async function leadOnlyProblems(request: MergeCheckRequest & { changedFiles: readonly string[] }): Promise<string[]> {
  if (request.authorIsLead) return []
  const changes = await leadOnlyChangesBetween(request)
  if (changes.length === 0) return []
  return [`改了只有负责人能改的内容：${changes.join('、')}；这类改动交给负责人（协作仓的协作者）提交`]
}

/** 在内存里算出把 head 合进 base 的树，不动工作区和分支；有冲突时给出冲突的文件 */
async function mergedTree(repo: string, base: string, head: string): Promise<{ tree: string } | { conflicts: string[] }> {
  const output = await runGit(repo, ['merge-tree', '--write-tree', '--name-only', '-z', base, head])
  if (output.code !== 0 && output.code !== 1) throw new Error(`git merge-tree ${base} ${head} 失败：${output.stderr.trim()}`)
  const [tree, ...rest] = output.stdout.split('\0')
  if (output.code === 0) return { tree: tree!.trim() }
  // 冲突时 -z 输出：树、冲突的文件（以空串结束），之后是给人看的说明。
  // 退出码 1 却一个冲突文件都没列（stdout 是空的），是 head 指向不存在的版本这类失败，不是冲突，照原话报错
  const conflicts = rest.slice(0, rest.indexOf(''))
  if (conflicts.length === 0) throw new Error(`git merge-tree ${base} ${head} 失败：${output.stderr.trim()}`)
  return { conflicts }
}

/**
 * 执行器决定能不能直接合并：和 base 没有冲突，改了只有负责人能改的内容时提交的人是负责人。
 * 只管这两条安全上的事；记录格式、站点会不会打不开由成员提交前在本机查，这里不查
 */
export async function checkMerge(request: MergeCheckRequest): Promise<MergeCheck> {
  const { repo, base, head } = request
  const merged = await mergedTree(repo, base, head)
  if ('conflicts' in merged) {
    return { verdict: 'conflict', problems: [`和 ${base} 有冲突：${merged.conflicts.join('、')}；把 ${base} 合进来、按两边的意思改好冲突的文件，再提交`] }
  }
  const changedFiles = await changedFilesBetween(repo, base, merged.tree)
  const problems = await leadOnlyProblems({ ...request, head: merged.tree, changedFiles })
  return problems.length > 0 ? { verdict: 'needs-review', problems } : { verdict: 'mergeable', problems: [] }
}
