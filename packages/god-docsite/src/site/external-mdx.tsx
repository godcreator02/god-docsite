import { useMemo, type ComponentType, type ReactNode } from 'react'
import * as jsxRuntime from 'react/jsx-runtime'
import { DocsBody, DocsDescription, DocsPage, DocsTitle } from '@fumadocs/base-ui/layouts/docs/page'
import type { TOCItemType } from 'fumadocs-core/toc'

/** 全站的 remark / rehype 插件（站点 app/lib/mdx-plugins.ts 的 sitePlugins），站点上下文的 mdxPlugins() 给 */
export interface SiteMdxPluginLists {
  remarkPlugins: unknown[]
  rehypePlugins: unknown[]
}

/** 外部 mdx 文件的编译结果：ready 带代码串（function-body 格式）、frontmatter 与标题目录；broken 带编译器原话 */
export type ExternalMdx =
  | { state: 'ready'; frontmatter: Record<string, unknown>; code: string; toc: TOCItemType[] }
  | { state: 'broken'; message: string }

/** MDX 正文用的组件表：站点 app/lib/mdx-components 的 mdxComponents，再加上只在这类页里有的组件 */
export type ExternalMdxComponents = Record<string, ComponentType<never> | string>

type MdxContent = ComponentType<{ components?: ExternalMdxComponents }>

/**
 * function-body 格式的编译结果是一段函数体：参数是 JSX 运行时，回模块的导出，只能用 Function 构造运行。和 @mdx-js/mdx 的 runSync 做的一样，
 * 不 import 它：那会把整个 mdx 编译器带进浏览器，dev 下打开第一页时 Vite 才发现这个依赖、重新预构建并整页刷新
 */
function contentOf(code: string): MdxContent {
  // oxlint-disable-next-line typescript/no-implied-eval
  return (new Function(code) as (runtime: typeof jsxRuntime) => { default: MdxContent })({ ...jsxRuntime }).default
}

/** 编译不过时显示的说明与编译器原话 */
export function ExternalMdxBroken({ message }: { message: string }) {
  return (
    <div data-external-mdx-broken="" className="not-prose rounded-lg border border-red-500/40 p-3 text-sm">
      <p className="font-medium text-red-600 dark:text-red-400">这一页编译不过</p>
      <pre className="mt-2 text-xs whitespace-pre-wrap [overflow-wrap:anywhere] text-fd-muted-foreground">{message}</pre>
    </div>
  )
}

/** 外部 mdx 的正文：ready 的在浏览器里运行编译好的代码串，broken 的显示原话；评论正文也用它 */
export function ExternalMdxContent({ compiled, components }: { compiled: ExternalMdx; components: ExternalMdxComponents }) {
  const Content = useMemo(() => (compiled.state === 'ready' ? contentOf(compiled.code) : null), [compiled])
  if (compiled.state === 'broken') return <ExternalMdxBroken message={compiled.message} />
  const ReadyContent = Content!
  return <ReadyContent components={components} />
}

export interface ExternalMdxPageProps {
  title: string
  description?: string | undefined
  compiled: ExternalMdx
  components: ExternalMdxComponents
  /** 正文容器上加的属性，如评论包的 commentScopeProps */
  bodyProps?: Record<string, string>
  /** 题目下面、正文上面放的东西：功能包的按钮与元数据块 */
  children?: ReactNode
}

/** 外部 mdx 页的页框：标题、右侧标题目录、题目下面功能包放的东西、正文容器；编译不过时正文换成编译器原话 */
export function ExternalMdxPage({ title, description, compiled, components, bodyProps = {}, children }: ExternalMdxPageProps) {
  return (
    <DocsPage toc={compiled.state === 'ready' ? compiled.toc : []}>
      <title>{title}</title>
      <DocsTitle>{title}</DocsTitle>
      {description ? <DocsDescription>{description}</DocsDescription> : null}
      {children}
      <DocsBody {...bodyProps}>
        <ExternalMdxContent compiled={compiled} components={components} />
      </DocsBody>
    </DocsPage>
  )
}
