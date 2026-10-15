/** 协作仓里自动合并工作流的位置（相对仓根）；模板是本包的 templates/collab-auto-merge.yaml */
export const mergeWorkflowPathInRepo = '.gitea/workflows/collab-auto-merge.yaml'

/** 模板里 MERGE_CHECK_RANGE 的占位：执行器按它装哪一版本包 */
const mergeWorkflowVersionPlaceholder = '{{version}}'

/** 模板里的 {{…}}：前面带 $ 的是 Gitea Actions 自己的表达式（${{ secrets.X }}），不是占位 */
const placeholderPattern = /(?<!\$)\{\{[^{}]*\}\}/g

/**
 * 把工作流模板写成协作仓里的那份：{{version}} 换成 ^<collabVersion>。
 * 模板里没有 {{version}}、换完还剩认不出的占位都报错：写出去的工作流执行器装不上检查工具
 */
export function renderMergeWorkflow(template: string, collabVersion: string): string {
  if (!template.includes(mergeWorkflowVersionPlaceholder)) throw new Error(`工作流模板里没有占位 ${mergeWorkflowVersionPlaceholder}：MERGE_CHECK_RANGE 那一行要写成它`)
  const rendered = template.replaceAll(mergeWorkflowVersionPlaceholder, `^${collabVersion}`)
  const unknownPlaceholders = [...new Set(rendered.match(placeholderPattern))]
  if (unknownPlaceholders.length > 0) throw new Error(`工作流模板里有认不出的占位 ${unknownPlaceholders.join('、')}：只认 ${mergeWorkflowVersionPlaceholder}`)
  return rendered
}
