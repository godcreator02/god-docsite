import { useState } from 'react'
import { useFetcher } from 'react-router'
import { Trash2 } from 'lucide-react'
import type { WriteResult } from '../page-data.js'
import { ErrorLine, PlainButton } from '../shared/parts.js'
import { writeErrorOf } from '../shared/write-result.js'
import { useCollabViewer, useIsLead } from '../shared/viewer.js'
import type { FieldTarget } from './field-write.js'

/**
 * 删除这条任务或这个模块：只有作者和负责人看得到，和写入规则一致。点了先问一次，确认才提交，删完 action 跳回任务页；
 * 被拒时（比如模块下还有任务）把原话写在下面
 */
export function DeleteRecord({ target, author, noun }: { target: FieldTarget; author: string; noun: string }) {
  const { person } = useCollabViewer()
  const isLead = useIsLead()
  const fetcher = useFetcher<WriteResult>()
  const [confirming, setConfirming] = useState(false)
  if (person === null || (person !== author && !isLead(person))) return null
  return (
    <div className="ml-auto grid justify-items-end gap-1">
      {confirming ? (
        <fetcher.Form method="post" action={target.action} className="flex flex-wrap items-center justify-end gap-2 text-[12.5px]">
          <input type="hidden" name="intent" value="delete-record" />
          <input type="hidden" name="id" value={target.recordId} />
          <span className="text-fd-muted-foreground">删掉这个{noun}？删了只能从 git 历史里找回</span>
          <PlainButton onClick={() => setConfirming(false)}>取消</PlainButton>
          <PlainButton type="submit" disabled={fetcher.state !== 'idle'} className="border-danger! text-danger hover:bg-danger-soft! disabled:opacity-35">
            确认删除
          </PlainButton>
        </fetcher.Form>
      ) : (
        <PlainButton onClick={() => setConfirming(true)} className="inline-flex items-center gap-1.5 text-fd-muted-foreground hover:text-danger">
          <Trash2 size={13} />
          删除
        </PlainButton>
      )}
      <ErrorLine message={writeErrorOf(fetcher.data)} />
    </div>
  )
}
