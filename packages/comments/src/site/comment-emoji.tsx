/**
 * 评论里的表情：每条评论下的表情回应（点了的人记进评论文件），与输入框里插入正文的表情选择器。
 * 回应只收 reactionEmojis 那几个；插入正文的表情不限，选择器里列的是常用的一组。样式在本包 styles.css 的同名类上
 */
import { useEffect, useRef, useState, type KeyboardEvent, type ReactNode } from 'react'
import { useFetcher } from 'react-router'
import { reactionEmojis, type ReactionEmoji } from '../core/reactions.js'
import { errorOf, type CommentReaction, type CommentWriter } from './comment-model.js'
import { CommentIcon } from './comment-icon.js'

/** 输入框选择器里列的表情：表情、手势、标记各一组 */
export const composerEmojis = [
  '😀', '😄', '😂', '🙂', '😉', '😊', '😍', '🤔', '😅', '😮', '😢', '😭', '😡', '😴',
  '👍', '👎', '👏', '🙌', '🙏', '💪', '👌', '✌️', '🤝', '👀',
  '❤️', '🎉', '🔥', '✨', '💯', '✅', '❌', '⚠️', '❓', '💡', '📌', '🚀', '⏰', '🐛', '🔧', '📎',
] as const

/** 点开的小面板：点面板外面或按 Esc 收起；Esc 不往外传，免得把整串评论的浮窗也收起来 */
function usePopover() {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    const closeOnOutsidePointer = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false)
    }
    document.addEventListener('pointerdown', closeOnOutsidePointer)
    return () => document.removeEventListener('pointerdown', closeOnOutsidePointer)
  }, [open])
  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key !== 'Escape' || !open) return
    event.stopPropagation()
    setOpen(false)
  }
  return { open, setOpen, rootRef, onKeyDown }
}

function EmojiGrid({ emojis, label, selected, onPick }: { emojis: readonly string[]; label: string; selected?: (emoji: string) => boolean; onPick: (emoji: string) => void }) {
  return (
    <div role="menu" aria-label={label} className="docsite-emoji-grid">
      {emojis.map((emoji) => (
        <button
          key={emoji}
          type="button"
          role="menuitem"
          className={selected?.(emoji) ? 'docsite-emoji-option docsite-emoji-option-selected' : 'docsite-emoji-option'}
          aria-pressed={selected === undefined ? undefined : selected(emoji)}
          data-emoji-option={emoji}
          onClick={() => onPick(emoji)}
        >
          {emoji}
        </button>
      ))}
    </div>
  )
}

function PopoverButton({ title, marker, children }: { title: string; marker: Record<`data-${string}`, string>; children: (close: () => void) => ReactNode }) {
  const { open, setOpen, rootRef, onKeyDown } = usePopover()
  return (
    <div ref={rootRef} className="docsite-emoji-popover-root" onKeyDown={onKeyDown}>
      <button type="button" className="docsite-icon-button" title={title} aria-label={title} aria-expanded={open} onClick={() => setOpen(!open)} {...marker}>
        <CommentIcon name="smile" />
      </button>
      {open ? <div className="docsite-emoji-popover">{children(() => setOpen(false))}</div> : null}
    </div>
  )
}

/** 写评论的输入框里的表情按钮：选中的表情交给 onPick，由输入框插在光标处 */
export function ComposerEmojiButton({ onPick }: { onPick: (emoji: string) => void }) {
  return (
    <PopoverButton title="插入表情" marker={{ 'data-composer-emoji': '' }}>
      {(close) => (
        <EmojiGrid
          emojis={composerEmojis}
          label="插入表情"
          onPick={(emoji) => {
            onPick(emoji)
            close()
          }}
        />
      )}
    </PopoverButton>
  )
}

/** 点在哪条评论上：串头不带 replyId */
export type ReactionTarget = { threadId: string; replyId?: string }

function reactionFieldsOf(target: ReactionTarget, emoji: ReactionEmoji, on: boolean): Record<string, string> {
  return { intent: on ? 'add-reaction' : 'remove-reaction', threadId: target.threadId, ...(target.replyId !== undefined ? { replyId: target.replyId } : {}), emoji }
}

function hasReacted(reactions: readonly CommentReaction[], emoji: ReactionEmoji, writer: CommentWriter): boolean {
  return reactions.some((reaction) => reaction.emoji === emoji && reaction.people.some((person) => person.id === writer.id))
}

/** 悬停工具条里的「加表情」：面板列出能点的表情，自己点过的高亮，再点一次撤掉 */
export function AddReactionButton({ action, target, reactions, writer }: { action: string; target: ReactionTarget; reactions: readonly CommentReaction[]; writer: CommentWriter }) {
  const fetcher = useFetcher()
  const error = errorOf(fetcher.data)
  return (
    <>
      <PopoverButton title="加表情" marker={{ 'data-add-reaction': target.replyId ?? target.threadId }}>
        {(close) => (
          <EmojiGrid
            emojis={reactionEmojis}
            label="加表情"
            selected={(emoji) => hasReacted(reactions, emoji as ReactionEmoji, writer)}
            onPick={(emoji) => {
              const reaction = emoji as ReactionEmoji
              void fetcher.submit(reactionFieldsOf(target, reaction, !hasReacted(reactions, reaction, writer)), { method: 'post', action })
              close()
            }}
          />
        )}
      </PopoverButton>
      {error ? <p data-action-error>{error}</p> : null}
    </>
  )
}

function peopleSentenceOf(reaction: CommentReaction): string {
  return `${reaction.people.map((person) => person.name).join('、')} 点了 ${reaction.emoji}`
}

/** 一个表情回应：可写时是按钮，自己点过的高亮，点了加上或撤掉；只读时只显示 */
function ReactionChip({ action, target, reaction, writer }: { action: string; target: ReactionTarget; reaction: CommentReaction; writer?: CommentWriter }) {
  const fetcher = useFetcher()
  const error = errorOf(fetcher.data)
  const content = (
    <>
      <span className="docsite-reaction-emoji">{reaction.emoji}</span>
      <span className="docsite-reaction-count">{reaction.people.length}</span>
    </>
  )
  if (writer === undefined) {
    return (
      <span className="docsite-reaction" title={peopleSentenceOf(reaction)} data-reaction={reaction.emoji}>
        {content}
      </span>
    )
  }
  const mine = reaction.people.some((person) => person.id === writer.id)
  return (
    <fetcher.Form method="post" action={action}>
      {Object.entries(reactionFieldsOf(target, reaction.emoji, !mine)).map(([name, value]) => (
        <input key={name} type="hidden" name={name} value={value} />
      ))}
      <button
        type="submit"
        className={mine ? 'docsite-reaction docsite-reaction-mine' : 'docsite-reaction'}
        aria-pressed={mine}
        title={`${peopleSentenceOf(reaction)}；${mine ? '点了撤掉' : '点了跟上'}`}
        disabled={fetcher.state !== 'idle'}
        data-reaction={reaction.emoji}
      >
        {content}
      </button>
      {error ? <p data-action-error>{error}</p> : null}
    </fetcher.Form>
  )
}

/** 一条评论正文下面的表情回应；没人点过就不占地方 */
export function ReactionBar({ action, target, reactions, writer }: { action: string; target: ReactionTarget; reactions: readonly CommentReaction[]; writer?: CommentWriter }) {
  if (reactions.length === 0) return null
  return (
    <div className="docsite-reactions" data-reactions-of={target.replyId ?? target.threadId}>
      {reactions.map((reaction) => (
        <ReactionChip key={reaction.emoji} action={action} target={target} reaction={reaction} writer={writer} />
      ))}
    </div>
  )
}
