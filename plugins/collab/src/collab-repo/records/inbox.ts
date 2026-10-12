import path from 'node:path'
import { collabState, inboxOf, type CollabProblem, type InboxItems, type Person } from '@godcreator/collab-model/task-model'
import { readCollabSnapshot } from '@godcreator/collab-model/task-model/node'
import { readCommentThreads } from '@godcreator/docsite-kit/files'
import { CollabRejected, messageOf } from '../../errors.js'
import { peopleOfRepo, type Project } from '../../project/project.js'

export type Inbox = InboxItems & {
  /** 读出记录时的问题，原样带上 */
  problems: CollabProblem[]
}

/** 站点 comments/ 里的评论串；格式不对时拒绝，原话是基础包列出的全部问题 */
async function commentThreadsOf(project: Project) {
  try {
    return await readCommentThreads(path.join(project.siteDir, 'comments'))
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
