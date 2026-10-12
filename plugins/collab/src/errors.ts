import { CollabFormatError } from '@godcreator/collab-model/task-model'
import { WriteRejected } from '@godcreator/collab-model/task-model/node'

/** 命令拒绝执行，或 git 报了错：消息原样交给人和 AI，写明原因和该怎么做 */
export class CollabRejected extends Error {
  override name = 'CollabRejected'
}

/** 报给人看的错误原话 */
export function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

/** 数据模型包的拒绝错误（WriteRejected、CollabFormatError）换成 CollabRejected，消息原样；别的原样抛回 */
export function rethrowAsCollabRejected(error: unknown): never {
  if (error instanceof WriteRejected || error instanceof CollabFormatError) throw new CollabRejected(error.message)
  throw error
}
