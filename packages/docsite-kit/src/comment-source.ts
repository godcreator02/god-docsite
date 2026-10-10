import { createHash } from 'node:crypto'
import { commentAnchorComponent, type CommentBlockSpec } from './comments.js'

/**
 * 页面源文件里的评论标记，编译插件与评论接口共用（只在 Node 里跑）。
 * 位置记行号与列号：fumadocs-mdx 编译前把 frontmatter 换成同样行数的空行，行列和源文件对得上，按字符数算的偏移量对不上
 */

/** 一块源码的指纹：评论接口用它确认页面打开后这一块没改过 */
export function sourceHash(text: string) {
  return createHash('sha1').update(text).digest('hex').slice(0, 10)
}

export function formatCommentBlockSpec({ placement, start, end, hash }: CommentBlockSpec) {
  return `${placement}:${start.line}:${start.column}:${end.line}:${end.column}:${hash}`
}

const specPattern = /^(inline|flow):(\d+):(\d+):(\d+):(\d+):([0-9a-f]+)$/

/** 网页传回来的块位置；写错时返回 undefined，由调用方报错 */
export function parseCommentBlockSpec(text: string): CommentBlockSpec | undefined {
  const match = specPattern.exec(text)
  if (!match) return undefined
  const [, placement, startLine, startColumn, endLine, endColumn, hash] = match
  return {
    placement: placement as CommentBlockSpec['placement'],
    start: { line: Number(startLine), column: Number(startColumn) },
    end: { line: Number(endLine), column: Number(endColumn) },
    hash: hash!,
  }
}

/** 行号、列号（都从 1 数）在源文件里是第几个字符；超出文件时返回 undefined */
export function offsetOfPoint(source: string, { line, column }: { line: number; column: number }) {
  let lineStart = 0
  for (let current = 1; current < line; current++) {
    const newline = source.indexOf('\n', lineStart)
    if (newline === -1) return undefined
    lineStart = newline + 1
  }
  const lineEnd = source.indexOf('\n', lineStart)
  const offset = lineStart + column - 1
  return offset > (lineEnd === -1 ? source.length : lineEnd) ? undefined : offset
}

export function anchorTagOf(id: string) {
  return `<${commentAnchorComponent} id="${id}" />`
}
