/**
 * 写任务与模块的表单约定（外部契约：页面组件按它提交，recordAction 按它收）：
 *   intent=create-record：type 与记录的字段（title、status、due、module…），成功后跳到新记录那一页
 *   intent=update-record：id、field、value，一次改一个字段
 *   intent=delete-record：id，成功后跳到任务页
 */
export const recordIntents = ['create-record', 'update-record', 'delete-record'] as const
export type RecordIntent = (typeof recordIntents)[number]

export function isRecordIntent(value: unknown): value is RecordIntent {
  return (recordIntents as readonly unknown[]).includes(value)
}
