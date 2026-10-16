import { useState, type ReactNode } from 'react'
import { useFetcher } from 'react-router'
import type { ModuleGroup } from '../../core/module-groups.js'
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

/** 分组下拉框里「不分组」的值，不会和分组 id 重名（分组 id 不以 - 开头）；没选过时是空串 */
const noGroupChoice = '-'

/** 新建模块：标题、截止日必填（甘特图要画）；有分组时还要选一组或明确选「不分组」，其余在模块那一页上填 */
export function NewModuleForm({ action, groups, onCancel }: NewRecordFormProps & { groups: ModuleGroup[] }) {
  const fetcher = useFetcher<WriteResult>()
  const [title, setTitle] = useState('')
  const [due, setDue] = useState('')
  const [groupChoice, setGroupChoice] = useState('')
  const groupChosen = groups.length === 0 || groupChoice !== ''
  return (
    <fetcher.Form method="post" action={action} className="grid gap-2.5">
      <input type="hidden" name="intent" value="create-record" />
      <input type="hidden" name="type" value="module" />
      <input type="hidden" name="title" value={title.trim()} />
      {groupChoice !== '' && groupChoice !== noGroupChoice && <input type="hidden" name="group" value={groupChoice} />}
      <Field label="标题">
        <input autoFocus aria-label="标题" value={title} onChange={(event) => setTitle(event.target.value)} className={inputClass} placeholder="一块大的工作，比如「采样板」" />
      </Field>
      <Field label="截止日">
        <input type="date" name="due" required value={due} onChange={(event) => setDue(event.target.value)} className={inputClass} />
      </Field>
      {groups.length > 0 && (
        <Field label="分组">
          <select aria-label="分组" value={groupChoice} onChange={(event) => setGroupChoice(event.target.value)} className={inputClass}>
            <option value="" disabled>
              选一组，画在那一组的甘特图上
            </option>
            {groups.map((group) => (
              <option key={group.id} value={group.id}>
                {group.title}
              </option>
            ))}
            <option value={noGroupChoice}>不分组</option>
          </select>
        </Field>
      )}
      <p className="m-0 text-[12px] text-fd-muted-foreground">建好后打开模块那一页，在那里填负责人和模块内容。</p>
      <ErrorLine message={writeErrorOf(fetcher.data)} />
      <FormButtons saving={fetcher.state !== 'idle'} canSave={title.trim() !== '' && due !== '' && groupChosen} submitLabel="新建模块" onCancel={onCancel} />
    </fetcher.Form>
  )
}
