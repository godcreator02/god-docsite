import { useState, type KeyboardEvent, type ReactNode } from 'react'
import { Link, useNavigate } from 'react-router'
import { ArrowLeft, ExternalLink, Pencil, Trash2 } from 'lucide-react'
import { WidePageToggle } from '@godcreator/docsite-kit/ui'
import { fieldsAnyoneMayChange, recordPageUrlOf, taskStatuses, tasksPageUrl, type ModuleState, type RecordType, type TaskState, type TaskStatus } from '@godcreator/collab-model/task-model'
import type { JournalMention } from '../journal.js'
import { journalUrlOf } from '../site-data.js'
import { moduleProgressOf } from '../timeline.js'
import { useCollabData, useIsLead, useNameOf } from './collab-data.js'
import { MarkdownContent } from './markdown.js'
import { PageRef } from './page-ref.js'
import { ErrorLine, PersonAvatar, PersonName, PlainButton, PrimaryButton, StatusDot, statusLabel } from './parts.js'
import { useCollabWriter } from './requests.js'

/** 本机身份能改这条记录的哪些字段，和写入规则一致：作者都能改，别人只能改 fieldsAnyoneMayChange 里列的；只读时什么都不能改 */
function useChangeableFields(type: RecordType, author: string) {
  const { person } = useCollabData()
  return (field: string) => person !== null && (author === person || fieldsAnyoneMayChange[type].includes(field))
}

/** 记录 id 开头 14 位是建它时的本地时间：2026-10-02 20:46 */
function createdAtOf(recordId: string) {
  const digits = recordId.slice(0, 14)
  return `${digits.slice(0, 4)}-${digits.slice(4, 6)}-${digits.slice(6, 8)} ${digits.slice(8, 10)}:${digits.slice(10, 12)}`
}

type FieldError = { field: string; message: string }

/** 改一个属性就写一次记录，只交出这一个字段；写入被拒时把原因记在那个属性上，值仍是记录里的（等于退回原样） */
function useFieldWriter(recordId: string) {
  const { update } = useCollabWriter()
  const [error, setError] = useState<FieldError | null>(null)
  const write = async (field: string, value: string) => {
    setError(null)
    try {
      await update(recordId, { [field]: value })
    } catch (writeError) {
      setError({ field, message: (writeError as Error).message })
    }
  }
  return { write, errorOf: (field: string) => (error?.field === field ? error.message : null) }
}

const inlineControlClass =
  'h-7 max-w-full min-w-0 rounded-md border border-transparent bg-transparent px-1.5 text-[13.5px] text-fd-foreground outline-none hover:border-fd-border hover:bg-fd-accent focus:border-fd-muted-foreground'

/** 属性区的一行：左边属性名，右边值；改不了的属性只显示值 */
function PropertyRow({ label, error = null, children }: { label: string; error?: string | null; children: ReactNode }) {
  return (
    <div className="grid grid-cols-[96px_minmax(0,1fr)] items-start gap-2 py-0.5 text-[13.5px]">
      <span className="pt-1 text-fd-muted-foreground">{label}</span>
      <div className="grid min-w-0 gap-0.5">
        <div className="flex min-h-7 min-w-0 items-center gap-1.5">{children}</div>
        <ErrorLine message={error} />
      </div>
    </div>
  )
}

function Empty({ children = '空' }: { children?: ReactNode }) {
  return <span className="px-1.5 text-fd-muted-foreground">{children}</span>
}

/** 负责人：从人员列表里选（agent 不列）；已经指派了的只能换人，不能清空 */
function OwnerProperty({ owner, editable, onChange, error }: { owner: string | undefined; editable: boolean; onChange: (owner: string) => void; error: string | null }) {
  const people = useCollabData().people.filter((person) => !person.agent)
  return (
    <PropertyRow label="负责人" error={error}>
      {!editable ? (
        owner ? (
          <span className="px-1.5">
            <PersonName personId={owner} />
          </span>
        ) : (
          <Empty>未指派</Empty>
        )
      ) : (
        <>
          {owner && <PersonAvatar personId={owner} size={18} />}
          <select aria-label="负责人" value={owner ?? ''} onChange={(event) => onChange(event.target.value)} className={inlineControlClass}>
            {owner === undefined && <option value="">未指派</option>}
            {people.map((person) => (
              <option key={person.id} value={person.id}>
                {person.name}
              </option>
            ))}
          </select>
        </>
      )}
    </PropertyRow>
  )
}

/** 日期：已经填了的只能换，不能清空（required 时选不出空值） */
function DateProperty({ label, value, editable, onChange, error }: { label: string; value: string | undefined; editable: boolean; onChange: (day: string) => void; error: string | null }) {
  return (
    <PropertyRow label={label} error={error}>
      {!editable ? (
        value ? <span className="px-1.5 tabular-nums">{value}</span> : <Empty />
      ) : (
        <input
          type="date"
          aria-label={label}
          value={value ?? ''}
          required={value !== undefined}
          onChange={(event) => event.target.value !== '' && onChange(event.target.value)}
          className={`${inlineControlClass} tabular-nums ${value ? '' : 'text-fd-muted-foreground'}`}
        />
      )}
    </PropertyRow>
  )
}

function StatusProperty({ status, editable, onChange, error }: { status: TaskStatus; editable: boolean; onChange: (status: TaskStatus) => void; error: string | null }) {
  return (
    <PropertyRow label="状态" error={error}>
      <StatusDot status={status} size={14} />
      {!editable ? (
        <span className="px-1.5">{statusLabel[status]}</span>
      ) : (
        <select aria-label="状态" value={status} onChange={(event) => onChange(event.target.value as TaskStatus)} className={inlineControlClass}>
          {taskStatuses.map((option) => (
            <option key={option} value={option}>
              {statusLabel[option]}
            </option>
          ))}
        </select>
      )}
    </PropertyRow>
  )
}

function OpenRecordLink({ recordId, title }: { recordId: string; title: string }) {
  return (
    <Link to={recordPageUrlOf(recordId)} title="打开模块那一页" aria-label={`打开模块 ${title}`} className="inline-flex size-6 shrink-0 items-center justify-center rounded text-fd-muted-foreground hover:bg-fd-accent hover:text-fd-foreground">
      <ExternalLink size={13} />
    </Link>
  )
}

/** 所属模块：选一个模块；已经归进模块的只能换，不能清空。选了就旁边给一个进模块那一页的链接 */
function ModuleProperty({ moduleId, editable, onChange, error }: { moduleId: string | undefined; editable: boolean; onChange: (moduleId: string) => void; error: string | null }) {
  const { modules } = useCollabData()
  const current = moduleId === undefined ? undefined : modules.find((module) => module.id === moduleId)
  return (
    <PropertyRow label="所属模块" error={error}>
      {editable ? (
        <select aria-label="所属模块" value={moduleId ?? ''} onChange={(event) => onChange(event.target.value)} className={inlineControlClass}>
          {moduleId === undefined && <option value="">不归入模块</option>}
          {modules.map((module) => (
            <option key={module.id} value={module.id}>
              {module.title}
            </option>
          ))}
        </select>
      ) : current ? (
        <span className="truncate px-1.5">{current.title}</span>
      ) : (
        <Empty>不归入模块</Empty>
      )}
      {current && <OpenRecordLink recordId={current.id} title={current.title} />}
    </PropertyRow>
  )
}

/** 链接的页面：从站里的页面选一页；已经链接了的只能换，不能清空。选了就旁边给到那一页的链接 */
function PageProperty({ pageUrl, editable, onChange, error }: { pageUrl: string | undefined; editable: boolean; onChange: (pageUrl: string) => void; error: string | null }) {
  const { pages } = useCollabData()
  return (
    <PropertyRow label="链接的页面" error={error}>
      {editable && (
        <select aria-label="链接的页面" value={pageUrl ?? ''} onChange={(event) => onChange(event.target.value)} className={`${inlineControlClass} ${pageUrl ? '' : 'text-fd-muted-foreground'}`}>
          {pageUrl === undefined && <option value="">不链接页面</option>}
          {pages.map((page) => (
            <option key={page.url} value={page.url}>
              {page.title}
            </option>
          ))}
        </select>
      )}
      {pageUrl ? (
        <span className="min-w-0 px-1.5 text-[12.5px]">
          <PageRef url={pageUrl} />
        </span>
      ) : (
        !editable && <Empty>不链接页面</Empty>
      )}
    </PropertyRow>
  )
}

/** 标题：能改时点一下变成输入框，回车或点别处保存，Esc 放弃；不能清空 */
function TitleField({ title, editable, onSave }: { title: string; editable: boolean; onSave: (title: string) => Promise<void> }) {
  const [draft, setDraft] = useState<string | null>(null)
  const headingClass = 'm-0 text-2xl font-semibold break-words'
  if (!editable) return <h1 className={headingClass}>{title}</h1>
  if (draft === null) {
    return (
      <h1 className={headingClass}>
        <button type="button" title="点一下改标题" onClick={() => setDraft(title)} className="-mx-1.5 rounded-md px-1.5 text-left hover:bg-fd-accent">
          {title}
        </button>
      </h1>
    )
  }
  const finish = async () => {
    const next = draft.trim()
    setDraft(null)
    if (next !== '' && next !== title) await onSave(next)
  }
  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') event.currentTarget.blur()
    if (event.key === 'Escape') setDraft(null)
  }
  return (
    <h1 className={headingClass}>
      <input
        autoFocus
        aria-label="标题"
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={finish}
        onKeyDown={onKeyDown}
        className="-mx-1.5 w-full rounded-md border border-fd-muted-foreground bg-fd-background px-1.5 font-[inherit] text-[length:inherit] outline-none"
      />
    </h1>
  )
}

/** 输入框至少这么多行，内容多了跟着变高 */
const minimumEditorRows = 12

function SectionHeading({ children }: { children: ReactNode }) {
  return <h2 className="m-0 text-[16px] font-semibold">{children}</h2>
}

/**
 * 任务或模块的内容：按 Markdown 排版显示。能改时有「编辑」，点了变成输入框，保存才写进记录；
 * 写过的内容不能清空（记录里的文字字段不能是空字符串）
 */
function ContentSection({ recordId, heading, text, editable }: { recordId: string; heading: string; text: string | undefined; editable: boolean }) {
  const { update } = useCollabWriter()
  const [draft, setDraft] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const save = async () => {
    setSaving(true)
    setError(null)
    try {
      await update(recordId, { detail: draft!.trim() })
      setDraft(null)
    } catch (writeError) {
      setError((writeError as Error).message)
    } finally {
      setSaving(false)
    }
  }
  const editing = draft !== null
  const cannotClear = editing && draft.trim() === '' && text !== undefined
  return (
    <section className="grid gap-3">
      <div className="flex items-center gap-3 border-b border-fd-border pb-2">
        <SectionHeading>{heading}</SectionHeading>
        {editable && !editing && (
          <PlainButton onClick={() => setDraft(text ?? '')} className="ml-auto inline-flex items-center gap-1.5">
            <Pencil size={13} />
            编辑
          </PlainButton>
        )}
      </div>
      {editing ? (
        <div className="grid gap-2">
          <textarea
            autoFocus
            aria-label={heading}
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            rows={Math.max(minimumEditorRows, draft.split('\n').length + 1)}
            placeholder="写要做什么、怎么做、做到什么程度算完成。支持 Markdown：# 标题、1. 编号列表、- 列表、```代码块```、| 表格 |"
            className="w-full resize-y rounded-md border border-fd-border bg-fd-background px-3 py-2 font-mono text-[13px] leading-relaxed outline-none focus:border-fd-muted-foreground"
          />
          {cannotClear && <ErrorLine message="写过的内容不能清空，可以改成别的文字" />}
          <ErrorLine message={error} />
          <div className="flex justify-end gap-2">
            <PlainButton onClick={() => setDraft(null)}>取消</PlainButton>
            <PrimaryButton onClick={save} disabled={saving || draft.trim() === (text ?? '') || draft.trim() === ''}>
              保存
            </PrimaryButton>
          </div>
        </div>
      ) : text ? (
        <MarkdownContent text={text} />
      ) : (
        <p className="m-0 text-[13.5px] text-fd-muted-foreground">{editable ? `还没写${heading}，点「编辑」写下要做什么、怎么做、做到什么程度算完成` : `没有写${heading}`}</p>
      )}
    </section>
  )
}

function BackToTasks() {
  return (
    <Link to={tasksPageUrl} className="inline-flex items-center gap-1.5 text-[13px] text-fd-muted-foreground no-underline hover:text-fd-foreground">
      <ArrowLeft size={14} />
      任务
    </Link>
  )
}

/**
 * 删除这条任务或这个模块：只有作者和负责人看得到，和写入规则一致。点了先问一次，确认才删，删完回任务页；
 * 被拒时（比如模块下还有任务）把原话写在下面
 */
function DeleteRecord({ recordId, author, noun }: { recordId: string; author: string; noun: string }) {
  const { person } = useCollabData()
  const isLead = useIsLead()
  const { remove } = useCollabWriter()
  const navigate = useNavigate()
  const [confirming, setConfirming] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  if (person === null || (person !== author && !isLead(person))) return null
  const confirmDelete = async () => {
    setDeleting(true)
    setError(null)
    try {
      await remove(recordId)
      await navigate(tasksPageUrl)
    } catch (deleteError) {
      setError((deleteError as Error).message)
      setDeleting(false)
    }
  }
  return (
    <div className="ml-auto grid justify-items-end gap-1">
      {confirming ? (
        <div className="flex flex-wrap items-center justify-end gap-2 text-[12.5px]">
          <span className="text-fd-muted-foreground">删掉这个{noun}？删了只能从 git 历史里找回</span>
          <PlainButton onClick={() => setConfirming(false)}>取消</PlainButton>
          <PlainButton onClick={confirmDelete} disabled={deleting} className="border-danger! text-danger hover:bg-danger-soft! disabled:opacity-35">
            确认删除
          </PlainButton>
        </div>
      ) : (
        <PlainButton onClick={() => setConfirming(true)} className="inline-flex items-center gap-1.5 text-fd-muted-foreground hover:text-danger">
          <Trash2 size={13} />
          删除
        </PlainButton>
      )}
      <ErrorLine message={error} />
    </div>
  )
}

/** 日志引用这条记录的反向链接：哪几天的日志里写了 <RecordLink id="这条记录的 id" />，每天列出引用它的那一段，点日期进那一天的日志 */
function JournalMentions({ recordId, mentions }: { recordId: string; mentions: JournalMention[] }) {
  return (
    <section className="grid gap-2">
      <div className="border-b border-fd-border pb-2">
        <SectionHeading>日志里的进展</SectionHeading>
      </div>
      {mentions.length === 0 ? (
        <p className="m-0 text-[13.5px] text-fd-muted-foreground">
          还没有日志引用它。日志里写 <code>{`<RecordLink id="${recordId}" />`}</code>，这里就列出那一段
        </p>
      ) : (
        <ul className="m-0 grid list-none gap-2 p-0">
          {mentions.map((mention, index) => (
            <li key={`${mention.date}-${index}`} className="m-0 grid grid-cols-[6.5em_minmax(0,1fr)] gap-2 text-[13.5px] leading-relaxed">
              <Link to={journalUrlOf(mention.date)} className="tabular-nums">
                {mention.date}
              </Link>
              <span className="min-w-0 break-words">{mention.text}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

/** 页面最上面那一行：返回任务页、删除，最右边是基础包的全宽按钮 */
function RecordHeader({ children }: { children: ReactNode }) {
  return (
    <div className="flex items-start gap-3">
      <div className="flex min-w-0 flex-1 flex-wrap items-start gap-3">{children}</div>
      <WidePageToggle />
    </div>
  )
}

function Properties({ children }: { children: ReactNode }) {
  return <div className="grid gap-0.5 border-y border-fd-border py-3">{children}</div>
}

function AuthorRows({ recordId, author }: { recordId: string; author: string }) {
  return (
    <>
      <PropertyRow label="作者">
        <span className="px-1.5">
          <PersonName personId={author} />
        </span>
      </PropertyRow>
      <PropertyRow label="创建时间">
        <span className="px-1.5 tabular-nums">{createdAtOf(recordId)}</span>
      </PropertyRow>
    </>
  )
}

/** 一条任务那一页：标题、属性、任务内容、日志里的进展 */
function TaskView({ task, mentions }: { task: TaskState; mentions: JournalMention[] }) {
  const mayChange = useChangeableFields('task', task.author)
  const { write, errorOf } = useFieldWriter(task.id)
  return (
    <div className="grid gap-5">
      <RecordHeader>
        <BackToTasks />
        <DeleteRecord recordId={task.id} author={task.author} noun="任务" />
      </RecordHeader>
      <TitleField title={task.title} editable={mayChange('title')} onSave={(title) => write('title', title)} />
      <Properties>
        <StatusProperty status={task.status} editable={mayChange('status')} onChange={(status) => void write('status', status)} error={errorOf('status')} />
        <OwnerProperty owner={task.owner} editable={mayChange('owner')} onChange={(owner) => void write('owner', owner)} error={errorOf('owner')} />
        <DateProperty label="截止日" value={task.due} editable={mayChange('due')} onChange={(due) => void write('due', due)} error={errorOf('due')} />
        <ModuleProperty moduleId={task.module} editable={mayChange('module')} onChange={(module) => void write('module', module)} error={errorOf('module')} />
        <PageProperty pageUrl={task.page} editable={mayChange('page')} onChange={(page) => void write('page', page)} error={errorOf('page')} />
        <AuthorRows recordId={task.id} author={task.author} />
      </Properties>
      <ContentSection recordId={task.id} heading="任务内容" text={task.detail} editable={mayChange('detail')} />
      <JournalMentions recordId={task.id} mentions={mentions} />
    </div>
  )
}

function ModuleTasks({ tasks }: { tasks: TaskState[] }) {
  const nameOf = useNameOf()
  return (
    <section className="grid gap-2">
      <div className="border-b border-fd-border pb-2">
        <SectionHeading>这个模块的任务</SectionHeading>
      </div>
      {tasks.length === 0 ? (
        <p className="m-0 text-[13.5px] text-fd-muted-foreground">还没有任务归进这个模块</p>
      ) : (
        <ul className="m-0 grid list-none gap-0.5 p-0">
          {tasks.map((task) => (
            <li key={task.id} className="m-0">
              <Link to={recordPageUrlOf(task.id)} className="flex min-w-0 items-center gap-2 rounded-md px-2 py-1.5 text-[13.5px] text-fd-foreground no-underline hover:bg-fd-accent">
                <StatusDot status={task.status} size={14} />
                <span className="min-w-0 flex-1 truncate">{task.title}</span>
                {task.owner && <span className="max-w-32 shrink-0 truncate text-[12px] text-fd-muted-foreground">{nameOf(task.owner)}</span>}
                {task.due && <span className="shrink-0 text-[12px] text-fd-muted-foreground tabular-nums">{task.due}</span>}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

/** 一个模块那一页：标题、属性（含进度）、模块内容、归进来的任务、日志里的进展 */
function ModuleView({ module, mentions }: { module: ModuleState; mentions: JournalMention[] }) {
  const { tasks } = useCollabData()
  const mayChange = useChangeableFields('module', module.author)
  const { write, errorOf } = useFieldWriter(module.id)
  const moduleTasks = tasks.filter((task) => task.module === module.id)
  const { done, total } = moduleProgressOf(module.id, moduleTasks)
  return (
    <div className="grid gap-5">
      <RecordHeader>
        <BackToTasks />
        <DeleteRecord recordId={module.id} author={module.author} noun="模块" />
      </RecordHeader>
      <TitleField title={module.title} editable={mayChange('title')} onSave={(title) => write('title', title)} />
      <Properties>
        <OwnerProperty owner={module.owner} editable={mayChange('owner')} onChange={(owner) => void write('owner', owner)} error={errorOf('owner')} />
        <DateProperty label="截止日" value={module.due} editable={mayChange('due')} onChange={(due) => void write('due', due)} error={errorOf('due')} />
        <PropertyRow label="进度">
          <span className="px-1.5 tabular-nums">
            做完 {done} / {total}
          </span>
        </PropertyRow>
        <AuthorRows recordId={module.id} author={module.author} />
      </Properties>
      <ContentSection recordId={module.id} heading="模块内容" text={module.detail} editable={mayChange('detail')} />
      <ModuleTasks tasks={moduleTasks} />
      <JournalMentions recordId={module.id} mentions={mentions} />
    </div>
  )
}

/** /tasks/<记录 id>：按 id 找到任务或模块，画对应的那一种；都不是就说明找不到。mentions 是路由的 loader 读的「日志里的进展」 */
export function RecordPage({ recordId, mentions }: { recordId: string; mentions: JournalMention[] }) {
  const { tasks, modules } = useCollabData()
  const task = tasks.find((entry) => entry.id === recordId)
  if (task) return <TaskView key={task.id} task={task} mentions={mentions} />
  const module = modules.find((entry) => entry.id === recordId)
  if (module) return <ModuleView key={module.id} module={module} mentions={mentions} />
  return (
    <div className="grid gap-4">
      <BackToTasks />
      <p className="m-0 text-fd-muted-foreground">没有 id 为 {recordId} 的任务或模块，可能已经被删掉了。</p>
    </div>
  )
}

/** 任务或模块那一页的窗口标题用的名字；不存在为 null */
export function useRecordTitle(recordId: string): string | null {
  const { tasks, modules } = useCollabData()
  return [...tasks, ...modules].find((record) => record.id === recordId)?.title ?? null
}
