/** 本插件拒绝做某件事：消息直接给人看，写明原因与怎么改；命令回执照原话回 ok: false */
export class DocsiteRejected extends Error {
  override name = 'DocsiteRejected'
}

export function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}
