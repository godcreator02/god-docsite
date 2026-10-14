/** 划字评论存在 anchor 里的定位：start/end 是页面文字（见 site/browser/page-text）里的偏移 */
export interface TextAnchorFields {
  /** 发起那一刻选中的原文（页面文字规则下的字，含原子字） */
  quote: string
  start: number
  /** 不含 end */
  end: number
  /** 发起那一刻的整页文字；正文改了以后按它与当前页面文字的逐字差异把 start/end 推算过来 */
  snapshot: string
}

/**
 * 串头 anchor 字段解析后的目标：整页（字段缺省）、页面元素（纯字符串 id）、划字（JSON，TextAnchorFields）。
 * 以 { 开头却解析不出 TextAnchorFields 的是 broken：文件被手改坏了，界面标成「锚点数据认不出」，不让它挂掉整页
 */
export type CommentAnchor =
  | { kind: 'page' }
  | { kind: 'element'; id: string }
  | ({ kind: 'text' } & TextAnchorFields)
  | { kind: 'broken'; raw: string }

function textAnchorOf(value: unknown): CommentAnchor {
  if (value === null || typeof value !== 'object') return { kind: 'broken', raw: JSON.stringify(value) }
  const { quote, start, end, snapshot } = value as Record<string, unknown>
  if (typeof quote !== 'string' || typeof start !== 'number' || typeof end !== 'number' || typeof snapshot !== 'string') {
    return { kind: 'broken', raw: JSON.stringify(value) }
  }
  return { kind: 'text', quote, start, end, snapshot }
}

export function parseCommentAnchor(anchor: string | undefined): CommentAnchor {
  if (anchor === undefined || anchor === '') return { kind: 'page' }
  if (!anchor.startsWith('{')) return { kind: 'element', id: anchor }
  try {
    return textAnchorOf(JSON.parse(anchor))
  } catch {
    return { kind: 'broken', raw: anchor }
  }
}

/** 划字评论的 anchor 字段值 */
export function serializeTextAnchor(fields: TextAnchorFields): string {
  return JSON.stringify(fields)
}
