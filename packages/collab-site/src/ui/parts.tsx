import { useId, type ButtonHTMLAttributes, type KeyboardEvent, type ReactNode } from 'react'
import { TriangleAlert, X } from 'lucide-react'
import type { TaskStatus } from '@godcreator/collab-model/task-model'
import { Avatar } from '@godcreator/docsite-identity/react'
import { useCollabData, useIsLead, useNameOf } from './collab-data.js'

export const statusLabel: Record<TaskStatus, string> = { todo: '未开始', doing: '进行中', done: '已完成' }

/** 任务状态的圆点：未开始是虚线圈，进行中是半满，已完成是实心带勾 */
export function StatusDot({ status, size = 14 }: { status: TaskStatus; size?: number }) {
  if (status === 'done') {
    return (
      <svg width={size} height={size} viewBox="0 0 16 16" aria-label={statusLabel.done} className="shrink-0 text-done">
        <circle cx="8" cy="8" r="7" fill="currentColor" />
        <path d="m5 8.2 2 2 4-4.2" fill="none" stroke="var(--color-fd-background)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    )
  }
  if (status === 'doing') {
    return (
      <svg width={size} height={size} viewBox="0 0 16 16" aria-label={statusLabel.doing} className="shrink-0 text-info">
        <circle cx="8" cy="8" r="6.2" fill="none" stroke="currentColor" strokeWidth="1.6" />
        <path d="M8 4a4 4 0 0 1 0 8z" fill="currentColor" />
      </svg>
    )
  }
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" aria-label={statusLabel.todo} className="shrink-0 text-fd-muted-foreground">
      <circle cx="8" cy="8" r="6.2" fill="none" stroke="currentColor" strokeWidth="1.6" strokeDasharray="2.6 2" />
    </svg>
  )
}

/** 一个人的头像：项目负责人右下角一颗小星（界面上别处不写角色） */
export function PersonAvatar({ personId, size = 22 }: { personId: string; size?: number }) {
  const nameOf = useNameOf()
  const isLead = useIsLead()
  const name = nameOf(personId)
  const lead = isLead(personId)
  const starSize = Math.max(9, Math.round(size * 0.5))
  return (
    <span title={lead ? `${name}（负责人）` : name} className="relative inline-flex shrink-0">
      <Avatar person={{ id: personId, name }} size={size} />
      {lead && (
        <svg width={starSize} height={starSize} viewBox="0 0 24 24" aria-label="负责人" className="absolute" style={{ right: -starSize * 0.3, bottom: -starSize * 0.3 }}>
          <path d="m12 2.5 2.9 6 6.6.9-4.8 4.6 1.2 6.5L12 17.4l-5.9 3.1 1.2-6.5L2.5 9.4l6.6-.9z" fill="#eab308" stroke="var(--color-fd-background)" strokeWidth="2.5" strokeLinejoin="round" />
        </svg>
      )}
    </span>
  )
}

/** 头像加显示名 */
export function PersonName({ personId, size = 18 }: { personId: string; size?: number }) {
  const nameOf = useNameOf()
  return (
    <span className="inline-flex min-w-0 items-center gap-1.5">
      <PersonAvatar personId={personId} size={size} />
      <span className="truncate">{nameOf(personId)}</span>
    </span>
  )
}

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement>

/** 次要按钮：取消这类；默认 type="button"，表单里要提交时自己传 type */
export function PlainButton({ className = '', ...props }: ButtonProps) {
  return <button type="button" {...props} className={`h-7 rounded-md border border-fd-border px-2.5 text-[12.5px] hover:bg-fd-accent ${className}`} />
}

/** 主按钮：保存、新建这类；不能点时变淡 */
export function PrimaryButton({ className = '', ...props }: ButtonProps) {
  return <button type="button" {...props} className={`h-7 rounded-md bg-fd-primary px-3 text-[12.5px] font-medium text-fd-primary-foreground disabled:opacity-35 ${className}`} />
}

/** 表单下面的一行报错；没有错时不占位置 */
export function ErrorLine({ message }: { message: string | null }) {
  if (!message) return null
  return (
    <p className="m-0 flex gap-1.5 text-[12px] text-danger">
      <TriangleAlert size={13} className="mt-0.5 shrink-0" />
      {message}
    </p>
  )
}

/** 本机能不能写任务与模块：站点经 gwb-docsite 启动、本 home 的身份码在人员列表里才能写 */
export function useCanWrite(): boolean {
  return useCollabData().person !== null
}

/** 盖住整个窗口的弹窗：点背景、按 Esc、点右上角的关闭都关掉 */
export function Dialog({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  const titleId = useId()
  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key !== 'Escape') return
    event.preventDefault()
    onClose()
  }
  return (
    <div onClick={(event) => event.target === event.currentTarget && onClose()} className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/35 px-4 pt-[12vh] pb-8">
      <div role="dialog" aria-modal="true" aria-labelledby={titleId} onKeyDown={onKeyDown} className="w-full max-w-[520px] rounded-xl border border-fd-border bg-fd-card shadow-lg">
        <header className="flex h-11 items-center gap-2 border-b border-fd-border pr-2 pl-4">
          <h2 id={titleId} className="m-0 text-[14px] font-semibold">
            {title}
          </h2>
          <button type="button" title="关闭（Esc）" aria-label="关闭（Esc）" onClick={onClose} className="ml-auto inline-flex size-7 items-center justify-center rounded-md text-fd-muted-foreground hover:bg-fd-accent hover:text-fd-foreground">
            <X size={16} />
          </button>
        </header>
        <div className="p-4">{children}</div>
      </div>
    </div>
  )
}
