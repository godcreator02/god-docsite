import { useFetcher } from 'react-router'
import { fieldsAnyoneMayChange, type RecordType } from '../../core/records.js'
import type { WriteResult } from '../page-data.js'
import { writeErrorOf } from '../shared/write-result.js'
import { useCollabViewer } from '../shared/viewer.js'

/** 改哪一条记录、提交到哪：那个地址的路由 action 是 recordAction */
export type FieldTarget = { recordId: string; action: string }

/**
 * 改记录的一个字段：每个字段一个 fetcher，各自显示进行中与被拒的原话。写入中先显示正要写的值，
 * 写完以 loader 重新读到的记录为准；被写入规则拒绝时值仍是记录里的（等于退回原样），原话留在这个字段下面
 */
export function useFieldWrite(target: FieldTarget, field: string) {
  const fetcher = useFetcher<WriteResult>()
  const pendingValue = fetcher.formData?.get('value')
  return {
    write: (value: string) => void fetcher.submit({ intent: 'update-record', id: target.recordId, field, value }, { method: 'post', action: target.action }),
    shownValue: <Value extends string>(saved: Value | undefined): Value | undefined => (typeof pendingValue === 'string' ? (pendingValue as Value) : saved),
    writing: fetcher.state !== 'idle',
    error: writeErrorOf(fetcher.data),
  }
}

/** 本机身份能改这条记录的哪些字段，和写入规则一致：作者都能改，别人只能改 fieldsAnyoneMayChange 里列的；只读时什么都不能改 */
export function useChangeableFields(type: RecordType, author: string): (field: string) => boolean {
  const { person } = useCollabViewer()
  return (field) => person !== null && (author === person || fieldsAnyoneMayChange[type].includes(field))
}
