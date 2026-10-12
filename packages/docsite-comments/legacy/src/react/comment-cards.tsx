import { Component, createContext, Suspense, useContext, useRef, useState, type ClipboardEvent, type KeyboardEvent, type ReactNode } from 'react'
import { mentionBeingTyped, peopleMatching, personOf, type Person } from '@godcreator/docsite-identity'
import { Avatar } from '@godcreator/docsite-identity/react'
import { commentFileName, type CommentEntry, type Commenter, type CommentThread } from '../comments.js'

/**
 * 评论接口：项目 routes.ts 里 route('api/comments', …) 的地址。
 * onWritten 是可选的写成功回调：一次写入真正成功（接口 2xx、拿到新评论串名与文件名）后调一次，给宿主做自己的后续动作（如重新读取数据并刷新页面）；失败的请求不调
 */
export type CommentApi = { url: string; onWritten?: (written: { thread: string; file: string }) => void }

/** 发一次请求；失败时把接口回的原话当报错，成功后通知 api.onWritten（若有） */
export async function postComment(api: CommentApi, fields: Record<string, string>, images: readonly File[] = []) {
  const form = new FormData()
  for (const [key, value] of Object.entries(fields)) form.set(key, value)
  for (const image of images) form.append('image', image)
  const response = await fetch(api.url, { method: 'POST', body: form })
  if (!response.ok) throw new Error(await response.text())
  const written = (await response.json()) as { thread: string; file: string }
  api.onWritten?.(written)
  return written
}

async function fetchCommentSource(api: CommentApi, thread: string, file: string) {
  const response = await fetch(`${api.url}?${new URLSearchParams({ thread, file })}`)
  if (!response.ok) throw new Error(await response.text())
  return response.text()
}

/**
 * 发评论后要打开的评论串：开发服务看到文件变了会整页刷新，刷新后照它重新打开。
 * 改一个文件开发服务可能连着刷新两次，所以读了不删，15 秒内的刷新都重新打开
 */
const openAfterReloadKey = 'docsite-comments:open-comment-thread'
const openAfterReloadWithinMs = 15_000

export function rememberThreadToOpen(thread: string) {
  try {
    sessionStorage.setItem(openAfterReloadKey, JSON.stringify({ thread, at: Date.now() }))
  } catch {
    // 会话存储不可用（隐私模式等）时，刷新后不自动打开，评论照样发出去了
  }
}

export function recentThreadToOpen(): string | undefined {
  try {
    const remembered = sessionStorage.getItem(openAfterReloadKey)
    if (!remembered) return undefined
    const { thread, at } = JSON.parse(remembered) as { thread: string; at: number }
    return Date.now() - at < openAfterReloadWithinMs ? thread : undefined
  } catch {
    return undefined
  }
}

/** 站点人员列表：PageComments 提供，评论卡片按 author、resolvedBy 里的 id 取名字 */
export const PeopleContext = createContext<readonly Person[] | null>(null)

function usePeople() {
  const people = useContext(PeopleContext)
  if (!people) throw new Error('评论卡片要放在 PageComments 里面：人员列表由它提供')
  return people
}

const minute = 60_000
const fullTime = new Intl.DateTimeFormat('zh-CN', { year: 'numeric', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })

/** 刚刚、几分钟前、几小时前、几天前，再早写日期；只在浏览器里算（评论卡片在服务端不渲染） */
function relativeTime(iso: string) {
  const elapsed = Date.now() - new Date(iso).getTime()
  if (elapsed < minute) return '刚刚'
  if (elapsed < 60 * minute) return `${Math.floor(elapsed / minute)} 分钟前`
  if (elapsed < 24 * 60 * minute) return `${Math.floor(elapsed / (60 * minute))} 小时前`
  if (elapsed < 7 * 24 * 60 * minute) return `${Math.floor(elapsed / (24 * 60 * minute))} 天前`
  return new Date(iso).toLocaleDateString('zh-CN')
}

const imageExtensionOf: Record<string, string> = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/gif': 'gif', 'image/webp': 'webp' }

type CommentEditorProps = {
  placeholder: string
  submitLabel: string
  initialText?: string
  autoFocus?: boolean
  onSubmit: (body: string, images: File[]) => Promise<void>
  onCancel?: () => void
}

/**
 * 评论正文渲染出错（如用了没定义的组件）时，在这条评论的位置写出错的原话；整页和别的评论照常显示。
 * 编译不过的在接口那一步就拒绝了，到这里的是编译过了、运行时才出错的
 */
class CommentBodyBoundary extends Component<{ children: ReactNode }, { error?: Error }> {
  override state: { error?: Error } = {}
  static getDerivedStateFromError(error: Error) {
    return { error }
  }
  override render() {
    if (this.state.error) return <p className="text-red-500">这条评论显示不出来：{this.state.error.message}</p>
    return this.props.children
  }
}

/** @ 后面弹出的名单最多列几个人 */
const mentionPickerSize = 8

/** 写 @ 时输入框下面的名单：点一个人填进他的 id；onMouseDown 不让输入框失去焦点 */
function MentionPicker({ candidates, activeIndex, onPick }: { candidates: Person[]; activeIndex: number; onPick: (person: Person) => void }) {
  return (
    <ul role="listbox" className="absolute top-full left-0 z-50 mt-1 w-64 overflow-hidden rounded-lg border border-[var(--docsite-comments-border)] bg-[var(--docsite-comments-card)] p-1 text-sm shadow-lg">
      {candidates.map((person, index) => (
        <li
          key={person.id}
          role="option"
          aria-selected={index === activeIndex}
          onMouseDown={(event) => {
            event.preventDefault()
            onPick(person)
          }}
          className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 aria-selected:bg-[var(--docsite-comments-accent)]"
        >
          <Avatar person={person} size={20} />
          <span className="truncate">{person.name}</span>
          <span className="ms-auto text-xs text-[var(--docsite-comments-muted-foreground)]">@{person.id}</span>
        </li>
      ))}
    </ul>
  )
}

/**
 * 写评论的输入框：写 MDX，纯文字、Markdown、组件都行；Ctrl+Enter（Mac 上 ⌘+Enter）发送、Esc 取消。
 * 粘贴图片时把图片记下来，在光标处插入 ![](./paste-….png)，发送时和文字一起交给接口，存进评论串的文件夹。
 * 打 @ 时弹出人员名单，按 id 或名字筛：上下键选、Enter 或 Tab 填进 @id、Esc 只关名单
 */
export function CommentEditor({ placeholder, submitLabel, initialText = '', autoFocus, onSubmit, onCancel }: CommentEditorProps) {
  const [text, setText] = useState(initialText)
  const [pastedImages, setPastedImages] = useState<File[]>([])
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string>()
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const people = usePeople()
  const [cursor, setCursor] = useState(initialText.length)
  const [activeMentionIndex, setActiveMentionIndex] = useState(0)
  /** 按 Esc 关掉名单时那个 @ 的位置：同一个 @ 不再弹，打新的 @ 照弹 */
  const [dismissedMentionStart, setDismissedMentionStart] = useState<number>()
  const typedMention = mentionBeingTyped(text.slice(0, cursor))
  const mentionCandidates =
    typedMention && typedMention.start !== dismissedMentionStart ? peopleMatching(people, typedMention.query).slice(0, mentionPickerSize) : []
  const pickMention = (person: Person) => {
    const textarea = textareaRef.current!
    const inserted = `@${person.id} `
    const caret = typedMention!.start + inserted.length
    setText(`${text.slice(0, typedMention!.start)}${inserted}${text.slice(cursor)}`)
    setCursor(caret)
    requestAnimationFrame(() => textarea.setSelectionRange(caret, caret))
  }
  const followCursor = () => setCursor(textareaRef.current!.selectionStart)

  const insertAtCursor = (inserted: string) => {
    const textarea = textareaRef.current!
    const { selectionStart, selectionEnd } = textarea
    const next = `${text.slice(0, selectionStart)}${inserted}${text.slice(selectionEnd)}`
    setText(next)
    requestAnimationFrame(() => textarea.setSelectionRange(selectionStart + inserted.length, selectionStart + inserted.length))
  }
  const pasteImages = (event: ClipboardEvent<HTMLTextAreaElement>) => {
    const files = [...event.clipboardData.files].filter((file) => file.type in imageExtensionOf)
    if (files.length === 0) return
    event.preventDefault()
    const stamp = Date.now().toString(36)
    const named = files.map((file, index) => new File([file], `paste-${stamp}-${index}.${imageExtensionOf[file.type]}`, { type: file.type }))
    setPastedImages((current) => [...current, ...named])
    insertAtCursor(named.map((file) => `![](./${file.name})`).join('\n'))
  }
  const submit = async () => {
    if (text.trim() === '' || sending) return
    setSending(true)
    setError(undefined)
    try {
      await onSubmit(text, pastedImages.filter((image) => text.includes(`./${image.name}`)))
      setText('')
      setPastedImages([])
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught))
    } finally {
      setSending(false)
    }
  }
  const onMentionKey = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    const count = mentionCandidates.length
    if (event.key === 'ArrowDown') setActiveMentionIndex((index) => (index + 1) % count)
    else if (event.key === 'ArrowUp') setActiveMentionIndex((index) => (index - 1 + count) % count)
    else if ((event.key === 'Enter' && !event.ctrlKey && !event.metaKey) || event.key === 'Tab') pickMention(mentionCandidates[Math.min(activeMentionIndex, count - 1)]!)
    else if (event.key === 'Escape') setDismissedMentionStart(typedMention!.start)
    else return false
    event.preventDefault()
    return true
  }
  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (mentionCandidates.length > 0 && onMentionKey(event)) return
    if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
      event.preventDefault()
      void submit()
    } else if (event.key === 'Escape' && onCancel) {
      event.preventDefault()
      onCancel()
    }
  }
  return (
    <div className="flex flex-col gap-1.5">
      <div className="relative">
        <textarea
          ref={textareaRef}
          value={text}
          autoFocus={autoFocus}
          placeholder={placeholder}
          rows={Math.min(8, Math.max(2, text.split('\n').length))}
          onChange={(event) => {
            setText(event.target.value)
            setCursor(event.target.selectionStart)
            setActiveMentionIndex(0)
          }}
          onSelect={followCursor}
          onPaste={pasteImages}
          onKeyDown={onKeyDown}
          className="w-full resize-none rounded-lg border border-[var(--docsite-comments-border)] bg-[var(--docsite-comments-background)] px-2.5 py-1.5 text-sm outline-none focus:border-[var(--docsite-comments-primary)]"
        />
        {mentionCandidates.length > 0 && <MentionPicker candidates={mentionCandidates} activeIndex={Math.min(activeMentionIndex, mentionCandidates.length - 1)} onPick={pickMention} />}
      </div>
      {error && <p className="text-xs text-red-500">{error}</p>}
      <div className="flex items-center justify-end gap-2 text-xs">
        <span className="me-auto text-[var(--docsite-comments-muted-foreground)]">Ctrl+Enter 发送{pastedImages.length > 0 ? ` · ${pastedImages.length} 张图片` : ''}</span>
        {onCancel && (
          <button type="button" onClick={onCancel} className="rounded-md px-2 py-1 text-[var(--docsite-comments-muted-foreground)] hover:bg-[var(--docsite-comments-accent)]">
            取消
          </button>
        )}
        <button
          type="button"
          onClick={() => void submit()}
          disabled={text.trim() === '' || sending}
          className="rounded-md bg-[var(--docsite-comments-primary)] px-2.5 py-1 font-medium text-[var(--docsite-comments-primary-foreground)] disabled:opacity-50"
        >
          {sending ? '发送中…' : submitLabel}
        </button>
      </div>
    </div>
  )
}

type CommentItemProps<Entry extends CommentEntry> = {
  entry: Entry
  thread: string
  renderBody: (entry: Entry) => ReactNode
  commenter: Commenter | null
  api: CommentApi
  /** 只显示正文开头几行（列表里的预览） */
  clamped?: boolean
}

/** 一条评论：头像、名字、时间、正文；自己写的那条可以编辑、删除 */
export function CommentItem<Entry extends CommentEntry>({ entry, thread, renderBody, commenter, api, clamped }: CommentItemProps<Entry>) {
  const [editingText, setEditingText] = useState<string>()
  const [error, setError] = useState<string>()
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const file = commentFileName(entry)
  const author = personOf(usePeople(), entry.author)
  const isOwn = commenter !== null && commenter.id === entry.author && !clamped
  const startEditing = async () => {
    setError(undefined)
    try {
      setEditingText(await fetchCommentSource(api, thread, file))
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught))
    }
  }
  const remove = async () => {
    setError(undefined)
    setConfirmingDelete(false)
    try {
      await postComment(api, { op: 'delete', thread, file })
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught))
    }
  }
  return (
    <div className="group/comment flex gap-2">
      <Avatar person={author} />
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-2 text-xs">
          <span className="font-medium text-[var(--docsite-comments-foreground)]">{author.name}</span>
          <time dateTime={entry.createdAt} title={fullTime.format(new Date(entry.createdAt))} className="text-[var(--docsite-comments-muted-foreground)]">
            {relativeTime(entry.createdAt)}
          </time>
          {isOwn && editingText === undefined &&
            (confirmingDelete ? (
              <span className="ms-auto flex gap-1">
                <span>{entry.kind === 'thread' ? '删除整串评论（连同所有回复）？' : '删除这条回复？'}</span>
                <button type="button" onClick={() => void remove()} className="rounded px-1 text-red-500 hover:bg-[var(--docsite-comments-accent)]">
                  确认
                </button>
                <button type="button" onClick={() => setConfirmingDelete(false)} className="rounded px-1 text-[var(--docsite-comments-muted-foreground)] hover:bg-[var(--docsite-comments-accent)]">
                  取消
                </button>
              </span>
            ) : (
              <span className="ms-auto hidden gap-1 group-hover/comment:flex">
                <button type="button" onClick={() => void startEditing()} className="rounded px-1 text-[var(--docsite-comments-muted-foreground)] hover:bg-[var(--docsite-comments-accent)] hover:text-[var(--docsite-comments-accent-foreground)]">
                  编辑
                </button>
                <button type="button" onClick={() => setConfirmingDelete(true)} className="rounded px-1 text-[var(--docsite-comments-muted-foreground)] hover:bg-[var(--docsite-comments-accent)] hover:text-red-500">
                  删除
                </button>
              </span>
            ))}
        </div>
        {editingText === undefined ? (
          <div className={`dc-comment-body mt-0.5 text-sm ${clamped ? 'max-h-16 overflow-hidden' : ''}`}>
            <CommentBodyBoundary>
              <Suspense fallback={<p className="text-[var(--docsite-comments-muted-foreground)]">正在加载……</p>}>{renderBody(entry)}</Suspense>
            </CommentBodyBoundary>
          </div>
        ) : (
          <div className="mt-1">
            <CommentEditor
              placeholder="改评论"
              submitLabel="保存"
              initialText={editingText}
              autoFocus
              onCancel={() => setEditingText(undefined)}
              onSubmit={async (body, images) => {
                await postComment(api, { op: 'edit', thread, file, body }, images)
                setEditingText(undefined)
              }}
            />
          </div>
        )}
        {error && <p className="mt-1 text-xs text-red-500">{error}</p>}
      </div>
    </div>
  )
}

type ThreadViewProps<Entry extends CommentEntry> = {
  thread: CommentThread<Entry>
  renderBody: (entry: Entry) => ReactNode
  commenter: Commenter | null
  api: CommentApi
  /** 卡片顶上写的一行说明，如「原文找不到了：……」 */
  note?: string
  onClose?: () => void
}

/**
 * 一个评论串：发起的那条、回复（多于一条时先收起）、回复框；顶上能标为已解决或重新打开。
 * 写成功（含删除）由 api.onWritten 通知宿主，随后的界面更新是宿主的事，这里不自己改显示
 */
export function ThreadView<Entry extends CommentEntry>({ thread, renderBody, commenter, api, note, onClose }: ThreadViewProps<Entry>) {
  const { head, replies } = thread
  const people = usePeople()
  const [repliesShown, setRepliesShown] = useState(replies.length <= 1)
  const [error, setError] = useState<string>()
  const resolved = head.status === 'resolved'
  const setStatus = async (op: 'resolve' | 'reopen') => {
    setError(undefined)
    try {
      rememberThreadToOpen(thread.id)
      await postComment(api, { op, thread: thread.id })
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught))
    }
  }
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2 text-xs">
        <span className={`rounded px-1.5 py-0.5 ${resolved ? 'bg-[var(--docsite-comments-muted)] text-[var(--docsite-comments-muted-foreground)]' : 'bg-amber-500/15 text-amber-700 dark:text-amber-300'}`}>
          {resolved ? `已解决${head.resolvedBy ? ` · ${personOf(people, head.resolvedBy).name}` : ''}` : '未解决'}
        </span>
        <span className="ms-auto flex gap-1">
          {commenter && (
            <button type="button" onClick={() => void setStatus(resolved ? 'reopen' : 'resolve')} className="rounded-md border border-[var(--docsite-comments-border)] px-2 py-0.5 hover:bg-[var(--docsite-comments-accent)]">
              {resolved ? '重新打开' : '✓ 解决'}
            </button>
          )}
          {onClose && (
            <button type="button" aria-label="关上" onClick={onClose} className="rounded-md px-1.5 py-0.5 text-[var(--docsite-comments-muted-foreground)] hover:bg-[var(--docsite-comments-accent)]">
              ✕
            </button>
          )}
        </span>
      </div>
      {note && <p className="border-s-2 border-s-[color:var(--docsite-comments-border)] ps-2 text-xs text-[var(--docsite-comments-muted-foreground)]">{note}</p>}
      {error && <p className="text-xs text-red-500">{error}</p>}
      <CommentItem entry={head} thread={thread.id} renderBody={renderBody} commenter={commenter} api={api} />
      {replies.length > 0 &&
        (repliesShown ? (
          replies.map((reply) => <CommentItem key={reply.info.path} entry={reply} thread={thread.id} renderBody={renderBody} commenter={commenter} api={api} />)
        ) : (
          <button type="button" onClick={() => setRepliesShown(true)} className="ms-8 self-start text-xs text-[var(--docsite-comments-primary)] hover:underline">
            展开 {replies.length} 条回复
          </button>
        ))}
      {commenter && (
        <div className="flex gap-2">
          <Avatar person={commenter} />
          <div className="min-w-0 flex-1">
            <CommentEditor
              placeholder="回复…"
              submitLabel="回复"
              onSubmit={async (body, images) => {
                rememberThreadToOpen(thread.id)
                await postComment(api, { op: 'reply', thread: thread.id, body }, images)
                setRepliesShown(true)
              }}
            />
          </div>
        </div>
      )}
    </div>
  )
}
