/**
 * 覆盖层需要的样式规则。::highlight() 的注册名带实例 id，与 highlight.ts 的画笔一一对应；
 * 组件挂载时随实例注入一次，卸载时移除。最终归评论包时可以把徽章规则并进包样式表，
 * 高亮规则仍需按实例名动态生成。
 * 位置类样式是内联的（每条评论坐标不同），这里只放外观与高亮颜色。
 */
export function overlayCssFor(key: string) {
  const quoteHighlight = `docsite-comments-overlay-${key}`
  const activeQuoteHighlight = `${quoteHighlight}-active`
  return `
::highlight(${quoteHighlight}) {
  background-color: color-mix(in srgb, var(--comment-overlay-accent, #d97706) 30%, transparent);
}
::highlight(${activeQuoteHighlight}) {
  background-color: color-mix(in srgb, var(--comment-overlay-accent, #d97706) 55%, transparent);
}
[data-comment-overlay-badge] {
  cursor: pointer;
  transition: filter 0.15s ease;
}
[data-comment-overlay-badge]:hover {
  filter: brightness(1.1);
}
`
}
