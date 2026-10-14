import { useState, type KeyboardEvent } from 'react'
import { ErrorLine } from '../shared/parts.js'
import { useFieldWrite, type FieldTarget } from './field-write.js'

const headingClass = 'm-0 text-2xl font-semibold break-words'

/** 标题：能改时点一下变成输入框，回车或点别处保存，Esc 放弃；不能清空 */
export function TitleField({ target, title, editable }: { target: FieldTarget; title: string; editable: boolean }) {
  const { write, shownValue, error } = useFieldWrite(target, 'title')
  const [draft, setDraft] = useState<string | null>(null)
  const shown = shownValue(title) ?? title
  if (!editable) return <h1 className={headingClass}>{shown}</h1>
  if (draft === null) {
    return (
      <div className="grid gap-1">
        <h1 className={headingClass}>
          <button type="button" title="点一下改标题" onClick={() => setDraft(shown)} className="-mx-1.5 rounded-md px-1.5 text-left hover:bg-fd-accent">
            {shown}
          </button>
        </h1>
        <ErrorLine message={error} />
      </div>
    )
  }
  const finish = () => {
    const next = draft.trim()
    setDraft(null)
    if (next !== '' && next !== title) write(next)
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
