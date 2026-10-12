import path from 'node:path'
import { existsSync } from 'node:fs'
import { collabState, inboxOf, type CollabProblem, type CommentThreadOnFile, type InboxItems, type Person } from '@godcreator/collab-model/task-model'
import { readCollabSnapshot } from '@godcreator/collab-model/task-model/node'
import { readCommentThreads } from '@godcreator/docsite-comments/server'
import { CollabRejected, messageOf } from '../../errors.js'
import { peopleOfRepo, type Project } from '../../project/project.js'

export type Inbox = InboxItems & {
  /** 读出记录时的问题，原样带上 */
  problems: CollabProblem[]
}

/** 评论文件的路径是 <串 id>/<文件名>（相对 comments/）：两段各取其一 */
const threadIdOf = (file: string) => file.split('/')[0]!
const fileNameOf = (file: string) => file.split('/')[1]!

/** 站点 comments/ 里的评论串；还没有 comments/ 就是还没有评论，格式不对时拒绝，原话是评论包列出的全部问题 */
async function commentThreadsOf(project: Project): Promise<CommentThreadOnFile[]> {
  const commentsDir = path.join(project.siteDir, 'comments')
  if (!existsSync(commentsDir)) return []
  try {
    const threads = await readCommentThreads(commentsDir)
    return threads.map(({ head, replies }) => ({
      id: threadIdOf(head.path),
      head: { authorId: head.authorId, ...(head.page !== undefined ? { page: head.page } : {}), file: fileNameOf(head.path), body: head.body },
      replies: replies.map((reply) => ({ authorId: reply.authorId, file: fileNameOf(reply.path), body: reply.body })),
    }))
  } catch (error) {
    throw new CollabRejected(`site/comments/ 里的评论读不对：\n${messageOf(error)}`)
  }
}

/** 工作区此刻交出的：找我的待办、记录读不对的问题、人员列表（短句里换显示名用） */
export type CollabRecordsState = { inbox: InboxItems; problems: CollabProblem[]; people: Person[] }

/** 现读工作区里的 collab/、site/people.json 与 site/comments/（网站显示的也是工作区里的）；读不对时照原话拒绝 */
export async function collabRecordsStateOf(project: Project): Promise<CollabRecordsState> {
  const state = collabState(await readCollabSnapshot(project.repo))
  const people = peopleOfRepo(project.repo)
  return { inbox: inboxOf(state, await commentThreadsOf(project), project.person, people), problems: state.problems, people }
}

/** 我的待办：现在该我处理的任务、评论 */
export async function collabInbox(project: Project): Promise<Inbox> {
  const { inbox, problems } = await collabRecordsStateOf(project)
  return { ...inbox, problems }
}
