import { existsSync } from 'node:fs'
import { readdir, readFile } from 'node:fs/promises'
import path from 'node:path'
import { parse as parseYaml } from 'yaml'
import {
  commentFrontmatterSchema,
  commentSnapshotFile,
  mentionsOf,
  peopleFile,
  snapshotMismatchOf,
  type CommentFrontmatter,
  type CommentReplyFrontmatter,
  type CommentThreadFrontmatter,
  type Person,
} from '../comments.js'
import { sitePeople } from './comments.js'

/** 评论文件读出来的样子：frontmatter 加文件名（不含文件夹）与正文 */
export type CommentFile<Frontmatter extends CommentFrontmatter> = Frontmatter & { file: string; body: string }

/** 一个评论串：发起的那条与按时间排的回复 */
export type CommentThreadFile = { id: string; head: CommentFile<CommentThreadFrontmatter>; replies: Array<CommentFile<CommentReplyFrontmatter>> }

const frontmatterPattern = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/

function parsedCommentFile(relativePath: string, source: string): CommentFile<CommentFrontmatter> | string {
  const match = frontmatterPattern.exec(source)
  if (!match) return `${relativePath} 开头没有 frontmatter`
  let data: unknown
  try {
    data = parseYaml(match[1]!)
  } catch (error) {
    return `${relativePath} 的 frontmatter 不是 YAML：${error instanceof Error ? error.message : String(error)}`
  }
  const result = commentFrontmatterSchema({ path: relativePath })['~standard'].validate(data)
  if (result.issues) return result.issues.map((issue) => `${relativePath}：${issue.message}`).join('\n')
  return { ...result.value, file: path.posix.basename(relativePath), body: source.slice(match[0].length).replace(/\r\n/g, '\n').trim() }
}

/**
 * 读评论目录里的全部评论串，不经开发服务：agent 的命令、提交前的检查用。没有评论目录就是还没有评论。
 * 评论串文件夹里的 .md、.mdx 是评论文件，别的（snapshot.txt、图片、组件）不读。格式不对时报错，一次列出全部
 */
export async function readCommentThreads(commentsDir: string): Promise<CommentThreadFile[]> {
  if (!existsSync(commentsDir)) return []
  const problems: string[] = []
  const threads: CommentThreadFile[] = []
  for (const entry of await readdir(commentsDir, { withFileTypes: true })) {
    if (!entry.isDirectory()) {
      problems.push(`${entry.name} 要放在评论串自己的文件夹里，如 2026-10-10-search/index.mdx`)
      continue
    }
    const files = (await readdir(path.join(commentsDir, entry.name))).filter((file) => /\.mdx?$/.test(file))
    let head: CommentFile<CommentThreadFrontmatter> | undefined
    const replies: Array<CommentFile<CommentReplyFrontmatter>> = []
    for (const file of files) {
      const parsed = parsedCommentFile(`${entry.name}/${file}`, await readFile(path.join(commentsDir, entry.name, file), 'utf8'))
      if (typeof parsed === 'string') problems.push(parsed)
      else if (parsed.kind === 'thread') head = parsed
      else replies.push(parsed)
    }
    if (!head) {
      if (files.length > 0 && !files.includes('index.mdx')) problems.push(`评论串 ${entry.name} 没有发起的 index.mdx`)
      continue
    }
    threads.push({ id: entry.name, head, replies: replies.sort((a, b) => a.createdAt.localeCompare(b.createdAt)) })
  }
  if (problems.length > 0) throw new Error(problems.join('\n'))
  return threads.sort((a, b) => a.head.createdAt.localeCompare(b.head.createdAt))
}

/** 和某人有关的评论串：他发起的、他回复过的、正文里 @ 了他的（@<id>），给全部评论页的「和我有关」与待办用 */
export function commentThreadIdsAbout(threads: readonly CommentThreadFile[], personId: string, people: readonly Person[]): string[] {
  return threads
    .filter((thread) => [thread.head, ...thread.replies].some((entry) => entry.author === personId || mentionsOf(entry.body, people).includes(personId)))
    .map((thread) => thread.id)
}

function authorProblemsOf(threads: readonly CommentThreadFile[], people: readonly Person[]) {
  const known = new Set(people.map((person) => person.id))
  const problems: string[] = []
  for (const thread of threads) {
    for (const entry of [thread.head, ...thread.replies]) if (!known.has(entry.author)) problems.push(`${thread.id}/${entry.file} 的 author ${entry.author} 不在 ${peopleFile} 里`)
    const { resolvedBy } = thread.head
    if (resolvedBy !== undefined && !known.has(resolvedBy)) problems.push(`${thread.id}/${thread.head.file} 的 resolvedBy ${resolvedBy} 不在 ${peopleFile} 里`)
  }
  return problems
}

async function snapshotProblemsOf(threads: readonly CommentThreadFile[], commentsDir: string) {
  const problems: string[] = []
  for (const { id, head } of threads) {
    if (!head.range) continue
    const file = path.join(commentsDir, id, commentSnapshotFile)
    if (!existsSync(file)) {
      problems.push(`评论串 ${id} 写了 range，但文件夹里没有 ${commentSnapshotFile}`)
      continue
    }
    const mismatch = snapshotMismatchOf(head, (await readFile(file, 'utf8')).replace(/\r\n/g, '\n'))
    if (mismatch) problems.push(`评论串 ${id}：${mismatch}`)
  }
  return problems
}

/**
 * 站点检查（不启动开发服务）：人员列表的格式、评论文件的格式、评论作者在不在人员列表里、快照对不对得上。
 * 评论批的页面在不在要列出页面才知道，开发服务启动时查。返回全部问题，没有问题是空数组
 */
export async function siteProblems(siteDir: string): Promise<string[]> {
  let people: Person[]
  try {
    people = sitePeople(siteDir)
  } catch (error) {
    return [error instanceof Error ? error.message : String(error)]
  }
  const commentsDir = path.join(siteDir, 'comments')
  let threads: CommentThreadFile[]
  try {
    threads = await readCommentThreads(commentsDir)
  } catch (error) {
    return (error instanceof Error ? error.message : String(error)).split('\n')
  }
  return [...authorProblemsOf(threads, people), ...(await snapshotProblemsOf(threads, commentsDir))]
}
