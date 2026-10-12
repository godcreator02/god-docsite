/**
 * 功能包的模块经别名 @site（站点的 app/，由 ./vite 的 docsite() 设）读骨架里的模块；
 * 这里声明功能包源码引用的两个：./lib/source.server（页面树）与 ./lib/mdx-components（MDX 组件）。
 * 功能包在源码里写 /// <reference types="@godcreator/docsite-kit/site-modules" /> 引用这一份
 */

declare module '@site/lib/source.server' {
  /** 站名：content/meta.json 的 title */
  export function siteName(): string
  /** 站里每一页的地址与标题 */
  export function sitePageRefs(): Array<{ url: string; title: string }>
}

declare module '@site/lib/mdx-components' {
  import type { ComponentType } from 'react'
  /** fumadocs 的 MDX 组件并上各功能包的 mdxComponents */
  export const mdxComponents: Readonly<Record<string, ComponentType<any>>>
}
