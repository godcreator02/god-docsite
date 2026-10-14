import { useState, type ReactNode } from 'react'
import { useFetcher } from 'react-router'
import type { ModuleState } from '../../core/state.js'
import type { WriteResult } from '../page-data.js'
import { ErrorLine, PlainButton, PrimaryButton } from '../shared/parts.js'
import { writeErrorOf } from '../shared/write-result.js'

export const inputClass = 'h-8 w-full rounded-md border border-fd-border bg-fd-background px-2 text-[13px] outline-none focus:border-fd-muted-foreground'

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="grid gap-1 text-[12px] text-fd-muted-foreground">
      {label}
      {children}
    </label>
  )
}

function FormButtons({ saving, canSave, submitLabel, onCancel }: { saving: boolean; canSave: boolean; submitLabel: string; onCancel: () => void }) {
  return (
    <div className="flex justify-end gap-2">
      <PlainButton onClick={onCancel}>取消</PlainButton>
      <PrimaryButton type="submit" disabled={saving || !canSave}>
        {saving ? '新建中…' : submitLabel}
      </PrimaryButton>
    </div>
  )
}

type NewRecordFormProps = {
  /** 表单提交到的地址：那里的路由 action 是 recordAction，建好就跳到新记录那一页 */
  action: string
  onCancel: () => void
}

/** 新建任务：只填标题，筛选着某个模块时归进它；其余在任务那一页上填。被写入规则拒绝时原话留在表单里 */
export function NewTaskForm({ action, module, onCancel }: NewRecordFormProps & { module?: ModuleState }) {
  const fetcher = useFetcher<WriteResult>()
  const [title, setTitle] = useState('')
  return (
    <fetcher.Form method="post" action={action} className="grid gap-2.5">
      <input type="hidden" name="intent" value="create-record" />
      <input type="hidden" name="type" value="task" />
      <input type="hidden" name="status" value="todo" />
      {module && <input type="hidden" name="module" value={module.id} />}
      <input type="hidden" name="title" value={title.trim()} />
      <Field label="标题">
        <input autoFocus aria-label="标题" value={title} onChange={(event) => setTitle(event.target.value)} className={inputClass} placeholder="要做的事" />
      </Field>
      <p className="m-0 text-[12px] text-fd-muted-foreground">{module ? `归进模块「${module.title}」。` : ''}建好后打开任务那一页，在那里填负责人、截止日和任务内容。</p>
      <ErrorLine message={writeErrorOf(fetcher.data)} />
      <FormButtons saving={fetcher.state !== 'idle'} canSave={title.trim() !== ''} submitLabel="新建任务" onCancel={onCancel} />
    </fetcher.Form>
  )
}

/** 新建模块：标题、截止日必填（甘特图要画），其余在模块那一页上填 */
export function NewModuleForm({ action, onCancel }: NewRecordFormProps) {
  const fetcher = useFetcher<WriteResult>()
  const [title, setTitle] = useState('')
  const [due, setDue] = useState('')
  return (
    <fetcher.Form method="post" action={action} className="grid gap-2.5">
      <input type="hidden" name="intent" value="create-record" />
      <input type="hidden" name="type" value="module" />
      <input type="hidden" name="title" value={title.trim()} />
      <Field label="标题">
        <input autoFocus aria-label="标题" value={title} onChange={(event) => setTitle(event.target.value)} className={inputClass} placeholder="一块大的工作，比如「采样板」" />
      </Field>
      <Field label="截止日">
        <input type="date" name="due" required value={due} onChange={(event) => setDue(event.target.value)} className={inputClass} />
      </Field>
      <p className="m-0 text-[12px] text-fd-muted-foreground">建好后打开模块那一页，在那里填负责人和模块内容。</p>
      <ErrorLine message={writeErrorOf(fetcher.data)} />
      <FormButtons saving={fetcher.state !== 'idle'} canSave={title.trim() !== '' && due !== ''} submitLabel="新建模块" onCancel={onCancel} />
    </fetcher.Form>
  )
}
