/**
 * 评论界面里几处共用的零件：图标、作者行、评论正文、写评论的输入框、批的位置那一行。
 * 样式在本包 styles.css 的同名类上
 */
import { Component, useEffect, useRef, useState, type KeyboardEvent, type ReactNode } from 'react'
import { useFetcher } from 'react-router'
import { ComposerEmojiButton } from './comment-emoji.js'
import { errorOf, type CommentAvatar, type CommentBodyComponent, type CommentWriter } from './comment-model.js'
import { CommentIcon } from './comment-icon.js'

export { CommentIcon, type CommentIconName } from './comment-icon.js'

const fullTime = new Intl.DateTimeFormat('zh-CN', { year: 'numeric', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })
const minute = 60_000

/** 刚刚、几分钟前、几小时前、几天前，再早写日期；整时间停在 time 的 title 上 */
function relativeTime(iso: string) {
  const elapsed = Date.now() - new Date(iso).getTime()
  if (elapsed < minute) return '刚刚'
  if (elapsed < 60 * minute) return `${Math.floor(elapsed / minute)} 分钟前`
  if (elapsed < 24 * 60 * minute) return `${Math.floor(elapsed / (60 * minute))} 小时前`
  if (elapsed < 7 * 24 * 60 * minute) return `${Math.floor(elapsed / (24 * 60 * minute))} 天前`
  return new Date(iso).toLocaleDateString('zh-CN')
}

export function CommentTime({ at }: { at: string }) {
  return (
    <time dateTime={at} title={fullTime.format(new Date(at))} className="docsite-comment-time">
      {relativeTime(at)}
    </time>
  )
}

/** 作者行：头像、名字、相对时间；没有头像组件时用名字的头一个字 */
export function CommentHeading({ author, createdAt, AvatarComponent, avatarSize = 24 }: { author: CommentWriter; createdAt: string; AvatarComponent?: CommentAvatar; avatarSize?: number }) {
  return (
    <div className="docsite-comment-heading">
      <CommentAvatarOf author={author} AvatarComponent={AvatarComponent} size={avatarSize} />
      <span className="docsite-comment-authorname">{author.name}</span>
      <CommentTime at={createdAt} />
    </div>
  )
}

export function CommentAvatarOf({ author, AvatarComponent, size }: { author: CommentWriter; AvatarComponent?: CommentAvatar; size: number }) {
  if (AvatarComponent) return <AvatarComponent {...author} size={size} />
  return (
    <span className="docsite-comment-initial" style={{ width: size, height: size, fontSize: Math.round(size * 0.48) }}>
      {author.name.slice(0, 1).toUpperCase()}
    </span>
  )
}

/**
 * dev 下刚写入的评论：服务端清单已更新，浏览器里已加载的集合入口还没有它的模块，
 * 正文组件会抛「does not exist」；Vite 重新生成入口后整页刷新即恢复。
 * 这里用每条评论一个错误边界兜住这个窗口，不改正文、不碰框架。
 */
class CommentBodyBoundary extends Component<{ path: string; children: ReactNode }, { failed: boolean }> {
  override state = { failed: false }
  static getDerivedStateFromError() {
    return { failed: true }
  }
  override render() {
    if (this.state.failed) {
      return (
        <p data-comment-pending className="docsite-comment-pending">
          这条评论刚写入，等浏览器拿到编译入口后显示（刷新页面）。
        </p>
      )
    }
    return this.props.children
  }
}

export function CommentBody({ path, BodyComponent }: { path: string; BodyComponent: CommentBodyComponent }) {
  return (
    <CommentBodyBoundary key={path} path={path}>
      <BodyComponent path={path} />
    </CommentBodyBoundary>
  )
}

/** 一串评论批在哪：正文里（元素的说明或引的原文）、整页，或找不到了 */
export type ThreadPlace = 'body' | 'page' | 'missing'

/** 批的位置那一行：正文里的是左边一道黄线加原文，整页、找不到原文各带图标 */
export function ThreadQuote({ place, note }: { place: ThreadPlace; note?: string }) {
  if (place === 'page') {
    return (
      <p className="docsite-thread-quote docsite-thread-quote-page">
        <CommentIcon name="page" />
        <span>评论整页</span>
      </p>
    )
  }
  if (place === 'missing') {
    return (
      <p data-thread-note="" className="docsite-thread-quote docsite-thread-quote-missing">
        <CommentIcon name="alert" />
        <span>{note ?? '原文找不到了'}</span>
      </p>
    )
  }
  if (note === undefined) return null
  return (
    <p data-thread-note="" className="docsite-thread-quote">
      <span>{note}</span>
    </p>
  )
}

/** 写入成功的返回（字段见 comment-model 的写入约定） */
export type CommentWriteSuccess = { ok: true; intent: string; threadId?: string; replyId?: string }

function successOf(data: unknown): CommentWriteSuccess | null {
  if (data !== null && typeof data === 'object' && 'ok' in data && (data as { ok: unknown }).ok === true) return data as CommentWriteSuccess
  return null
}

export interface ComposerProps {
  action: string
  /** 和正文一起提交的隐藏字段（intent、page、threadId、anchor） */
  fields: Record<string, string>
  placeholder: string
  writer: CommentWriter
  AvatarComponent?: CommentAvatar
  autoFocus?: boolean
  /** 写在表单上的 data-* 属性（测试与宿主按它找表单） */
  formAttributes?: Record<`data-${string}`, string>
  onSent?: (result: CommentWriteSuccess) => void
}

/** 文本框随内容长高，最高 200px */
function fitTextareaHeight(textarea: HTMLTextAreaElement) {
  textarea.style.height = 'auto'
  textarea.style.height = `${Math.min(textarea.scrollHeight, 200)}px`
}

/**
 * 写评论的输入框（Notion 式）：头像、随内容长高的文本框、右边的表情与发送按钮；选的表情插在光标处。
 * Enter 发送，Shift+Enter 换行，输入法组字时的 Enter 不算；发出去了清空
 */
export function Composer({ action, fields, placeholder, writer, AvatarComponent, autoFocus, formAttributes, onSent }: ComposerProps) {
  const fetcher = useFetcher()
  const [body, setBody] = useState('')
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const error = errorOf(fetcher.data)
  const busy = fetcher.state !== 'idle'
  const sent = fetcher.state === 'idle' ? successOf(fetcher.data) : null
  useEffect(() => {
    if (!sent) return
    setBody('')
    onSent?.(sent)
  }, [sent])
  const insertEmoji = (emoji: string) => {
    const textarea = textareaRef.current!
    const start = textarea.selectionStart
    const caret = start + emoji.length
    setBody(body.slice(0, start) + emoji + body.slice(textarea.selectionEnd))
    requestAnimationFrame(() => {
      textarea.focus()
      textarea.setSelectionRange(caret, caret)
      fitTextareaHeight(textarea)
    })
  }
  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key !== 'Enter' || event.shiftKey || event.nativeEvent.isComposing) return
    event.preventDefault()
    if (body.trim() !== '' && !busy) event.currentTarget.form?.requestSubmit()
  }
  const ready = body.trim() !== '' && !busy
  return (
    <fetcher.Form method="post" action={action} className={ready ? 'docsite-composer docsite-composer-ready' : 'docsite-composer'} {...formAttributes}>
      {Object.entries(fields).map(([name, value]) => (
        <input key={name} type="hidden" name={name} value={value} />
      ))}
      <span className="docsite-composer-avatar">
        <CommentAvatarOf author={writer} AvatarComponent={AvatarComponent} size={24} />
      </span>
      <div className="docsite-composer-box">
        <textarea
          ref={textareaRef}
          name="body"
          required
          rows={1}
          autoFocus={autoFocus}
          // 放在浮窗里时，浮窗定好位才看得见，到那时由浮窗按这个属性补一次聚焦
          data-autofocus={autoFocus ? '' : undefined}
          placeholder={placeholder}
          value={body}
          onChange={(event) => {
            setBody(event.target.value)
            fitTextareaHeight(event.target)
          }}
          onKeyDown={onKeyDown}
        />
        <ComposerEmojiButton onPick={insertEmoji} />
        <button type="submit" className="docsite-composer-send" disabled={!ready} title={busy ? '写入中…' : '发送（Enter）'} aria-label="发送">
          <CommentIcon name="send" />
        </button>
      </div>
      {error ? <p data-action-error>{error}</p> : null}
    </fetcher.Form>
  )
}
