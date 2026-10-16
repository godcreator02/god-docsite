import type { ReactNode } from 'react'
import { Link } from 'react-router'
import { ExternalLink } from 'lucide-react'
import { recordPageUrlOf } from '../../core/layout.js'
import type { ModuleGroup } from '../../core/module-groups.js'
import { taskStatuses, type TaskStatus } from '../../core/records.js'
import type { ModuleState } from '../../core/state.js'
import type { SitePageRef } from '../page-data.js'
import { PageRef } from '../shared/page-ref.js'
import { ErrorLine, PersonAvatar, PersonName, StatusDot, statusLabel } from '../shared/parts.js'
import { useCollabViewer } from '../shared/viewer.js'
import { useFieldWrite, type FieldTarget } from './field-write.js'

const inlineControlClass =
  'h-7 max-w-full min-w-0 rounded-md border border-transparent bg-transparent px-1.5 text-[13.5px] text-fd-foreground outline-none hover:border-fd-border hover:bg-fd-accent focus:border-fd-muted-foreground'

/** 属性区的一行：左边属性名，右边值；改不了的属性只显示值 */
export function PropertyRow({ label, error = null, children }: { label: string; error?: string | null; children: ReactNode }) {
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

export function Properties({ children }: { children: ReactNode }) {
  return <div className="grid gap-0.5 border-y border-fd-border py-3">{children}</div>
}

function Empty({ children = '空' }: { children?: ReactNode }) {
  return <span className="px-1.5 text-fd-muted-foreground">{children}</span>
}

type EditableProperty = { target: FieldTarget; editable: boolean }

/** 负责人：从人员列表里选（agent 不列）；已经指派了的只能换人，不能清空 */
export function OwnerProperty({ target, editable, owner }: EditableProperty & { owner: string | undefined }) {
  const people = useCollabViewer().people.filter((person) => !person.agent)
  const { write, shownValue, error } = useFieldWrite(target, 'owner')
  const shown = shownValue(owner)
  return (
    <PropertyRow label="负责人" error={error}>
      {!editable ? (
        shown ? (
          <span className="px-1.5">
            <PersonName personId={shown} />
          </span>
        ) : (
          <Empty>未指派</Empty>
        )
      ) : (
        <>
          {shown && <PersonAvatar personId={shown} size={18} />}
          <select aria-label="负责人" value={shown ?? ''} onChange={(event) => write(event.target.value)} className={inlineControlClass}>
            {shown === undefined && <option value="">未指派</option>}
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

/** 截止日：已经填了的只能换，不能清空（required 时选不出空值） */
export function DueProperty({ target, editable, due }: EditableProperty & { due: string | undefined }) {
  const { write, shownValue, error } = useFieldWrite(target, 'due')
  const shown = shownValue(due)
  return (
    <PropertyRow label="截止日" error={error}>
      {!editable ? (
        shown ? <span className="px-1.5 tabular-nums">{shown}</span> : <Empty />
      ) : (
        <input
          type="date"
          aria-label="截止日"
          value={shown ?? ''}
          required={shown !== undefined}
          onChange={(event) => event.target.value !== '' && write(event.target.value)}
          className={`${inlineControlClass} tabular-nums ${shown ? '' : 'text-fd-muted-foreground'}`}
        />
      )}
    </PropertyRow>
  )
}

export function StatusProperty({ target, editable, status }: EditableProperty & { status: TaskStatus }) {
  const { write, shownValue, error } = useFieldWrite(target, 'status')
  const shown = shownValue(status) ?? status
  return (
    <PropertyRow label="状态" error={error}>
      <StatusDot status={shown} size={14} />
      {!editable ? (
        <span className="px-1.5">{statusLabel[shown]}</span>
      ) : (
        <select aria-label="状态" value={shown} onChange={(event) => write(event.target.value)} className={inlineControlClass}>
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

export function OpenRecordLink({ recordId, title }: { recordId: string; title: string }) {
  return (
    <Link to={recordPageUrlOf(recordId)} title="打开模块那一页" aria-label={`打开模块 ${title}`} className="inline-flex size-6 shrink-0 items-center justify-center rounded text-fd-muted-foreground hover:bg-fd-accent hover:text-fd-foreground">
      <ExternalLink size={13} />
    </Link>
  )
}

/** 所属模块：选一个模块；已经归进模块的只能换，不能清空。选了就旁边给一个进模块那一页的链接 */
export function ModuleProperty({ target, editable, moduleId, modules }: EditableProperty & { moduleId: string | undefined; modules: ModuleState[] }) {
  const { write, shownValue, error } = useFieldWrite(target, 'module')
  const shown = shownValue(moduleId)
  const current = shown === undefined ? undefined : modules.find((module) => module.id === shown)
  return (
    <PropertyRow label="所属模块" error={error}>
      {editable ? (
        <select aria-label="所属模块" value={shown ?? ''} onChange={(event) => write(event.target.value)} className={inlineControlClass}>
          {shown === undefined && <option value="">不归入模块</option>}
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

/** 模块的分组：从分组列表里选；已经分了组的只能换，不能清空。写的分组不在列表里时照原样显示 id */
export function GroupProperty({ target, editable, groupId, groups }: EditableProperty & { groupId: string | undefined; groups: readonly ModuleGroup[] }) {
  const { write, shownValue, error } = useFieldWrite(target, 'group')
  const shown = shownValue(groupId)
  const current = shown === undefined ? undefined : groups.find((group) => group.id === shown)
  const shownTitle = shown === undefined ? undefined : (current?.title ?? shown)
  return (
    <PropertyRow label="分组" error={error}>
      {editable ? (
        <select aria-label="分组" value={shown ?? ''} onChange={(event) => write(event.target.value)} className={`${inlineControlClass} ${shown ? '' : 'text-fd-muted-foreground'}`}>
          {shown === undefined && <option value="">不分组</option>}
          {shown !== undefined && current === undefined && <option value={shown}>{shown}</option>}
          {groups.map((group) => (
            <option key={group.id} value={group.id}>
              {group.title}
            </option>
          ))}
        </select>
      ) : shownTitle ? (
        <span className="truncate px-1.5">{shownTitle}</span>
      ) : (
        <Empty>不分组</Empty>
      )}
    </PropertyRow>
  )
}

/** 链接的页面：从站里的页面选一页；已经链接了的只能换，不能清空。选了就旁边给到那一页的链接 */
export function PageProperty({ target, editable, pageUrl, pages }: EditableProperty & { pageUrl: string | undefined; pages: readonly SitePageRef[] }) {
  const { write, shownValue, error } = useFieldWrite(target, 'page')
  const shown = shownValue(pageUrl)
  return (
    <PropertyRow label="链接的页面" error={error}>
      {editable && (
        <select aria-label="链接的页面" value={shown ?? ''} onChange={(event) => write(event.target.value)} className={`${inlineControlClass} ${shown ? '' : 'text-fd-muted-foreground'}`}>
          {shown === undefined && <option value="">不链接页面</option>}
          {pages.map((page) => (
            <option key={page.url} value={page.url}>
              {page.title}
            </option>
          ))}
        </select>
      )}
      {shown ? (
        <span className="min-w-0 px-1.5 text-[12.5px]">
          <PageRef url={shown} pages={pages} />
        </span>
      ) : (
        !editable && <Empty>不链接页面</Empty>
      )}
    </PropertyRow>
  )
}

/** 记录 id 开头 14 位是建它时的本地时间：2026-10-02 20:46 */
function createdAtOf(recordId: string) {
  const digits = recordId.slice(0, 14)
  return `${digits.slice(0, 4)}-${digits.slice(4, 6)}-${digits.slice(6, 8)} ${digits.slice(8, 10)}:${digits.slice(10, 12)}`
}

export function AuthorRows({ recordId, author }: { recordId: string; author: string }) {
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
