import { useEffect, useState, type ReactNode } from 'react'
import { useFetcher } from 'react-router'
import { Pencil } from 'lucide-react'
import type { WriteResult } from '../page-data.js'
import { MarkdownContent } from '../shared/markdown.js'
import { ErrorLine, PlainButton, PrimaryButton } from '../shared/parts.js'
import { writeErrorOf } from '../shared/write-result.js'
import type { FieldTarget } from './field-write.js'

/** 输入框至少这么多行，内容多了跟着变高 */
const minimumEditorRows = 12

export function SectionHeading({ children }: { children: ReactNode }) {
  return <h2 className="m-0 text-[16px] font-semibold">{children}</h2>
}

function ContentEditor({ target, heading, text, onDone }: { target: FieldTarget; heading: string; text: string | undefined; onDone: () => void }) {
  const fetcher = useFetcher<WriteResult>()
  const [draft, setDraft] = useState(text ?? '')
  const saving = fetcher.state !== 'idle'
  useEffect(() => {
    if (fetcher.state === 'idle' && fetcher.data?.ok === true) onDone()
  }, [fetcher.state, fetcher.data, onDone])
  const cannotClear = draft.trim() === '' && text !== undefined
  return (
    <fetcher.Form method="post" action={target.action} className="grid gap-2">
      <input type="hidden" name="intent" value="update-record" />
      <input type="hidden" name="id" value={target.recordId} />
      <input type="hidden" name="field" value="detail" />
      <input type="hidden" name="value" value={draft.trim()} />
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
      <ErrorLine message={writeErrorOf(fetcher.data)} />
      <div className="flex justify-end gap-2">
        <PlainButton onClick={onDone}>取消</PlainButton>
        <PrimaryButton type="submit" disabled={saving || draft.trim() === (text ?? '') || draft.trim() === ''}>
          {saving ? '保存中…' : '保存'}
        </PrimaryButton>
      </div>
    </fetcher.Form>
  )
}

/**
 * 任务或模块的内容：按 Markdown 排版显示。能改时有「编辑」，点了变成输入框，保存才写进记录；
 * 写过的内容不能清空（记录里的文字字段不能是空字符串）
 */
export function ContentSection({ target, heading, text, editable }: { target: FieldTarget; heading: string; text: string | undefined; editable: boolean }) {
  const [editing, setEditing] = useState(false)
  return (
    <section className="grid gap-3">
      <div className="flex items-center gap-3 border-b border-fd-border pb-2">
        <SectionHeading>{heading}</SectionHeading>
        {editable && !editing && (
          <PlainButton onClick={() => setEditing(true)} className="ml-auto inline-flex items-center gap-1.5">
            <Pencil size={13} />
            编辑
          </PlainButton>
        )}
      </div>
      {editing ? (
        <ContentEditor target={target} heading={heading} text={text} onDone={() => setEditing(false)} />
      ) : text ? (
        <MarkdownContent text={text} />
      ) : (
        <p className="m-0 text-[13.5px] text-fd-muted-foreground">{editable ? `还没写${heading}，点「编辑」写下要做什么、怎么做、做到什么程度算完成` : `没有写${heading}`}</p>
      )}
    </section>
  )
}
