import type { GetLayoutTabsOptions } from '@fumadocs/base-ui/layouts/shared'

/**
 * 侧栏顶上的下拉框（meta.json 写了 "root": true 的文件夹各是一项）：交给 glass 的 DocsLayout 的 tabs。
 * fumadocs 默认把图标包在 size-full 的一层里，要外面再套一个定了大小的框；glass 的下拉按钮没套，图标撑满整个按钮。
 * 这里把图标放进一个固定大小的方框
 */
export const layoutTabsWithFramedIcons: GetLayoutTabsOptions = {
  transform: (option, node) => ({
    ...option,
    icon: node.icon ? <span className="flex size-7 shrink-0 items-center justify-center rounded-md border bg-fd-secondary text-fd-primary [&_svg]:size-4">{node.icon}</span> : undefined,
  }),
}
