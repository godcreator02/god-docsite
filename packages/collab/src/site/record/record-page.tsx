import { Link, useLoaderData } from 'react-router'
import { DocsPage } from '@fumadocs/base-ui/layouts/docs/page'
import { ArrowLeft } from 'lucide-react'
import { recordPageUrlOf, tasksPageUrl } from '../../core/layout.js'
import type { ModuleState, TaskState } from '../../core/state.js'
import { moduleProgressOf } from '../../core/timeline.js'
import type { RecordPageData } from '../page-data.js'
import { PageComments, type CommentBodyComponent } from '../shared/page-comments.js'
import { StatusDot } from '../shared/parts.js'
import { CollabViewerProvider, useNameOf } from '../shared/viewer.js'
import { ContentSection, SectionHeading } from './content-section.js'
import { DeleteRecord } from './delete-record.js'
import { useChangeableFields, type FieldTarget } from './field-write.js'
import { JournalMentions } from './journal-mentions.js'
import { AuthorRows, DueProperty, ModuleProperty, OwnerProperty, PageProperty, Properties, PropertyRow, StatusProperty } from './properties.js'
import { TitleField } from './title-field.js'

/** 页面最上面那一行：返回任务页、删除 */
function RecordHeader({ target, author, noun }: { target: FieldTarget; author: string; noun: string }) {
  return (
    <div className="flex flex-wrap items-start gap-3">
      <Link to={tasksPageUrl} className="inline-flex items-center gap-1.5 text-[13px] text-fd-muted-foreground no-underline hover:text-fd-foreground">
        <ArrowLeft size={14} />
        任务
      </Link>
      <DeleteRecord target={target} author={author} noun={noun} />
    </div>
  )
}

type RecordContext = { data: RecordPageData; target: FieldTarget }

/** 一条任务那一页：标题、属性、任务内容、日志里的进展 */
function TaskView({ task, context }: { task: TaskState; context: RecordContext }) {
  const { data, target } = context
  const mayChange = useChangeableFields('task', task.author)
  return (
    <div className="grid gap-5">
      <RecordHeader target={target} author={task.author} noun="任务" />
      <TitleField target={target} title={task.title} editable={mayChange('title')} />
      <Properties>
        <StatusProperty target={target} editable={mayChange('status')} status={task.status} />
        <OwnerProperty target={target} editable={mayChange('owner')} owner={task.owner} />
        <DueProperty target={target} editable={mayChange('due')} due={task.due} />
        <ModuleProperty target={target} editable={mayChange('module')} moduleId={task.module} modules={data.modules} />
        <PageProperty target={target} editable={mayChange('page')} pageUrl={task.page} pages={data.pages} />
        <AuthorRows recordId={task.id} author={task.author} />
      </Properties>
      <ContentSection target={target} heading="任务内容" text={task.detail} editable={mayChange('detail')} />
      <JournalMentions recordId={task.id} mentions={data.mentions} />
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
function ModuleView({ module, moduleTasks, context }: { module: ModuleState; moduleTasks: TaskState[]; context: RecordContext }) {
  const { data, target } = context
  const mayChange = useChangeableFields('module', module.author)
  const { done, total } = moduleProgressOf(module.id, moduleTasks)
  return (
    <div className="grid gap-5">
      <RecordHeader target={target} author={module.author} noun="模块" />
      <TitleField target={target} title={module.title} editable={mayChange('title')} />
      <Properties>
        <OwnerProperty target={target} editable={mayChange('owner')} owner={module.owner} />
        <DueProperty target={target} editable={mayChange('due')} due={module.due} />
        <PropertyRow label="进度">
          <span className="px-1.5 tabular-nums">
            做完 {done} / {total}
          </span>
        </PropertyRow>
        <AuthorRows recordId={module.id} author={module.author} />
      </Properties>
      <ContentSection target={target} heading="模块内容" text={module.detail} editable={mayChange('detail')} />
      <ModuleTasks tasks={moduleTasks} />
      <JournalMentions recordId={module.id} mentions={data.mentions} />
    </div>
  )
}

function recordIdOf(data: RecordPageData): string {
  return data.record.kind === 'task' ? data.record.task.id : data.record.module.id
}

/** 记录那一页的内容：按 loader 交来的那一条画任务或模块；改字段、删除提交到 action（recordAction 所在的地址） */
export function RecordView({ data, action }: { data: RecordPageData; action: string }) {
  const context: RecordContext = { data, target: { recordId: recordIdOf(data), action } }
  const { record } = data
  if (record.kind === 'task') return <TaskView key={record.task.id} task={record.task} context={context} />
  return <ModuleView key={record.module.id} module={record.module} moduleTasks={record.moduleTasks} context={context} />
}

/** /tasks/:recordId 的页面组件：读 recordLoader 的数据（找不到时 loader 已回 404），写入与评论都提交到这一页自己的路由 action（recordAction） */
export function RecordPage({ CommentBody }: { CommentBody: CommentBodyComponent }) {
  const data = useLoaderData<RecordPageData>()
  const url = recordPageUrlOf(recordIdOf(data))
  const title = data.record.kind === 'task' ? data.record.task.title : data.record.module.title
  return (
    <DocsPage>
      <title>{`${title} · ${data.siteName}`}</title>
      <CollabViewerProvider viewer={data}>
        <PageComments page={url} comments={data.comments} CommentBody={CommentBody}>
          <RecordView data={data} action={url} />
        </PageComments>
      </CollabViewerProvider>
    </DocsPage>
  )
}
