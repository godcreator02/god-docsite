import { useState } from 'react'
import { useLoaderData } from 'react-router'
import { DocsPage } from '@fumadocs/base-ui/layouts/docs/page'
import { ListPlus } from 'lucide-react'
import { tasksPageUrl } from '../../core/layout.js'
import type { TasksPageData } from '../page-data.js'
import { moduleColorsOf } from '../shared/module-marks.js'
import { PageComments, type CommentBodyComponent } from '../shared/page-comments.js'
import { Dialog } from '../shared/parts.js'
import { CollabViewerProvider, useCanWrite, useNameOf } from '../shared/viewer.js'
import { Board, tasksOwnedBy, type BoardFilter } from './board.js'
import { Gantt } from './gantt.js'
import { NewModuleForm, NewTaskForm } from './new-record-forms.js'
import { PeopleCards } from './people-cards.js'

type DialogState = { kind: 'new-task' } | { kind: 'new-module' } | null

function HeaderButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="inline-flex h-8 items-center gap-1.5 rounded-md border border-fd-border px-3 text-[13px] hover:bg-fd-accent">
      <ListPlus size={14} />
      {label}
    </button>
  )
}

function PersonFilterNote({ personId, onClear }: { personId: string; onClear: () => void }) {
  const nameOf = useNameOf()
  return (
    <span className="inline-flex items-center gap-2 text-[13px] text-fd-muted-foreground">
      只看 {nameOf(personId)} 的任务
      <button type="button" onClick={onClear} className="inline-flex h-6 items-center rounded-md border border-fd-border px-2 text-[12px] text-fd-foreground hover:bg-fd-accent">
        取消
      </button>
    </span>
  )
}

/**
 * 任务页的内容，从上到下三块：人员卡片、模块甘特图、任务看板。
 * 点人员卡片看板只显示他负责的任务，点甘特图上的模块看板只显示它的任务，两层筛选同时生效。
 * 能写时新建任务、模块在弹窗里只填最少的几项，提交到 action（recordAction 所在的地址），建好就跳到它那一页
 */
export function TasksView({ data, action }: { data: TasksPageData; action: string }) {
  const { tasks, modules, pages } = data
  const canWrite = useCanWrite()
  const [dialog, setDialog] = useState<DialogState>(null)
  const [filter, setFilter] = useState<BoardFilter>({ kind: 'all' })
  const [selectedPersonId, setSelectedPersonId] = useState<string | null>(null)
  const done = tasks.filter((task) => task.status === 'done').length
  const close = () => setDialog(null)
  const selectedModuleId = filter.kind === 'module' ? filter.id : null
  const toggleModule = (id: string) => setFilter(selectedModuleId === id ? { kind: 'all' } : { kind: 'module', id })
  const togglePerson = (id: string) => setSelectedPersonId(selectedPersonId === id ? null : id)
  const colors = moduleColorsOf(modules)
  return (
    <div className="grid gap-8">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="m-0 text-2xl font-semibold">任务</h1>
        <span className="text-[13px] text-fd-muted-foreground tabular-nums">
          全站已完成 {done} / {tasks.length}
        </span>
        {canWrite && (
          <span className="ml-auto flex gap-2">
            <HeaderButton label="新建模块" onClick={() => setDialog({ kind: 'new-module' })} />
            <HeaderButton label="新建任务" onClick={() => setDialog({ kind: 'new-task' })} />
          </span>
        )}
      </div>
      <section className="grid gap-3">
        <h2 className="m-0 text-lg font-semibold">人员</h2>
        <PeopleCards work={{ tasks, modules }} selectedId={selectedPersonId} onSelect={togglePerson} />
      </section>
      <section className="grid gap-3">
        <h2 className="m-0 text-lg font-semibold">模块</h2>
        <Gantt modules={modules} tasks={tasks} colors={colors} selectedId={selectedModuleId} onSelect={toggleModule} />
      </section>
      <section className="grid gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <h2 className="m-0 text-lg font-semibold">任务看板</h2>
          {selectedPersonId !== null && <PersonFilterNote personId={selectedPersonId} onClear={() => setSelectedPersonId(null)} />}
        </div>
        {tasks.length === 0 ? (
          <p className="m-0 text-[13px] text-fd-muted-foreground">还没有任务</p>
        ) : (
          <Board tasks={tasksOwnedBy(selectedPersonId, tasks)} context={{ modules, pages, colors }} filter={filter} setFilter={setFilter} />
        )}
      </section>
      {dialog?.kind === 'new-task' && (
        <Dialog title="新建任务" onClose={close}>
          <NewTaskForm action={action} module={modules.find((module) => module.id === selectedModuleId)} onCancel={close} />
        </Dialog>
      )}
      {dialog?.kind === 'new-module' && (
        <Dialog title="新建模块" onClose={close}>
          <NewModuleForm action={action} onCancel={close} />
        </Dialog>
      )}
    </div>
  )
}

/** /tasks 的页面组件：读 tasksLoader 的数据，写入与评论都提交到这一页自己的路由 action（recordAction）。CommentBody 是站点的评论正文组件 */
export function TasksPage({ CommentBody }: { CommentBody: CommentBodyComponent }) {
  const data = useLoaderData<TasksPageData>()
  return (
    <DocsPage full>
      <title>{`任务 · ${data.siteName}`}</title>
      <CollabViewerProvider viewer={data}>
        <PageComments page={tasksPageUrl} comments={data.comments} CommentBody={CommentBody}>
          <TasksView data={data} action={tasksPageUrl} />
        </PageComments>
      </CollabViewerProvider>
    </DocsPage>
  )
}
