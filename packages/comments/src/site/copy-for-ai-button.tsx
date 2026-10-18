import { useState } from 'react'
import { CommentIcon } from './comment-icon.js'

/** 复制成功后提示停留的毫秒数 */
const copiedNoticeMilliseconds = 3000

export interface CopyForAiButtonProps {
  /** 写进剪贴板的提示词 */
  prompt: string
  /** 复制成功后显示在按钮旁的一句话 */
  copiedNotice: string
  /** 按钮的 title */
  title: string
}

/**
 * 「复制给 AI」：把提示词写进剪贴板，粘贴给哪个 AI 由人定；写不进去（浏览器不让）把原因显示在按钮旁。
 * 评论串与协作站的提示栏共用这一个，样式在本包 styles.css 的 docsite-copy-for-ai
 */
export function CopyForAiButton({ prompt, copiedNotice, title }: CopyForAiButtonProps) {
  const [state, setState] = useState<{ kind: 'idle' } | { kind: 'copied' } | { kind: 'failed'; reason: string }>({ kind: 'idle' })
  const copy = () => {
    navigator.clipboard.writeText(prompt).then(
      () => {
        setState({ kind: 'copied' })
        setTimeout(() => setState({ kind: 'idle' }), copiedNoticeMilliseconds)
      },
      (error: unknown) => setState({ kind: 'failed', reason: error instanceof Error ? error.message : String(error) }),
    )
  }
  return (
    <span className="docsite-copy-for-ai">
      {state.kind === 'copied' && <span className="docsite-copy-for-ai-notice">{copiedNotice}</span>}
      {state.kind === 'failed' && <span className="docsite-copy-for-ai-failed">没能复制：{state.reason}</span>}
      <button type="button" onClick={copy} title={title} className="docsite-copy-for-ai-button">
        <CommentIcon name="copy" />
        复制给 AI
      </button>
    </span>
  )
}
