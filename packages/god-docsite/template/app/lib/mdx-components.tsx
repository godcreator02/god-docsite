import defaultMdxComponents from '@fumadocs/base-ui/mdx'
import type { MDXComponents } from 'mdx/types'
import { siteLinkComponent, siteMdxComponents } from '@godcreator/god-docsite/react'

/** MDX 页面与评论正文不用 import 就能写的组件；功能包的组件与链接种类加在这里 */
export const mdxComponents = {
  ...defaultMdxComponents,
  ...siteMdxComponents,
  a: siteLinkComponent([]),
} satisfies MDXComponents

declare global {
  type MDXProvidedComponents = typeof mdxComponents
}
