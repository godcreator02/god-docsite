/**
 * 讲解组件的机读版文字：站把每个组件的数据交给这几个函数，得到给 AI 读的一行行说明。
 * docfirst 站的 docfirst.config.mjs 在 Node 里加载这个入口，所以这里不许 import 任何东西，包括 react。
 */

/** 分步组件每一步一行：「第 1 步 · 标题：说明」 */
export function stepsText(steps: readonly { title: string; text: string }[]): string[] {
  return steps.map((step, index) => `第 ${index + 1} 步 · ${step.title}：${step.text}`);
}

/** 动画组件每一段一行：「第 1 段 · 标题：说明」 */
export function chaptersText(chapters: readonly { title: string; text: string }[]): string[] {
  return chapters.map((chapter, index) => `第 ${index + 1} 段 · ${chapter.title}：${chapter.text}`);
}

/** 选情况组件每种情况一行：「情况「label」：说明」 */
export function casesText(cases: readonly { label: string; text: string }[]): string[] {
  return cases.map((item) => `情况「${item.label}」：${item.text}`);
}
