// 原型：外部 mdx 页的页框（正式做法是平台 ./react 的 ExternalMdxPage）
import { useMemo, type ReactNode } from 'react'
import * as jsxRuntime from 'react/jsx-runtime'
import { runSync } from '@mdx-js/mdx'
import { DocsBody, DocsPage, DocsTitle } from '@fumadocs/base-ui/layouts/docs/page'
import type { TOCItemType } from 'fumadocs-core/toc'
import type { MDXComponents } from 'mdx/types'
import type { ExternalMdxResult } from './external-mdx.server'

function ReadyPage({ code, title, components, children }: { code: string; title: string; components: MDXComponents; children?: ReactNode }) {
  const { Content, toc } = useMemo(() => {
    const compiled = runSync(code, { ...jsxRuntime })
    return { Content: compiled.default, toc: compiled['toc'] as TOCItemType[] }
  }, [code])
  return (
    <DocsPage toc={toc}>
      <DocsTitle>{title}</DocsTitle>
      {children}
      <DocsBody>
        <Content components={components} />
      </DocsBody>
    </DocsPage>
  )
}

export function ExternalMdxPage({ data, components, children }: { data: ExternalMdxResult; components: MDXComponents; children?: ReactNode }) {
  if (data.state === 'ready') return <ReadyPage code={data.code} title={data.title} components={components}>{children}</ReadyPage>
  return (
    <DocsPage>
      <DocsTitle>{data.state === 'missing' ? '本站没有这条' : '编译不过'}</DocsTitle>
      {children}
      <DocsBody>{data.state === 'broken' ? <pre>{data.message}</pre> : null}</DocsBody>
    </DocsPage>
  )
}
