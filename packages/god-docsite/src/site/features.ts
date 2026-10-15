import type { ComponentType } from 'react'
import type { LoaderPlugin } from 'fumadocs-core/source'
import type { LoaderFunctionArgs } from 'react-router'
import type { BaseSiteContext } from './site-context.js'

/** MDX 正文里不用 import 就能写的组件：键是 MDX 里写的标签名；props 由各组件自己定，与 mdx/types 的 MDXComponents 一样收 any */
export type FeatureMdxComponents = Readonly<Record<string, ComponentType<any>>>

/**
 * 功能目录 app/features/<功能名>/feature.tsx 可以导出的几样，都可选。
 * 不变式：feature.tsx 会进浏览器，不能 import .server 模块或 Node 内置模块；layoutData 要的服务端数据只能经 base 的字段取
 */
export interface FeatureRuntimeModule {
  mdxComponents?: FeatureMdxComponents
  /** 接进站点 source.ts 的 loader({ plugins })，排在平台自己的插件后面 */
  pageTreePlugins?: readonly LoaderPlugin[]
  /** 布局 loader 调用；返回值以功能名为键并进布局数据。写成方法：功能可以把 base 声明成更具体的站点类型 */
  layoutData?(args: LoaderFunctionArgs, base: BaseSiteContext): unknown
  /** 布局顶部插槽：渲染在整站布局上方，自己用 useRouteLoaderData('routes/layout') 取自己那份数据 */
  LayoutTop?: ComponentType
}

export interface FeatureLayoutDataLoader {
  feature: string
  load(args: LoaderFunctionArgs, base: BaseSiteContext): unknown
}

export interface FeatureLayoutTop {
  feature: string
  Component: ComponentType
}

/** 全部功能的运行时部分合在一起：站点的 mdx-components、source.ts、布局路由各取一样 */
export interface SiteFeatureRuntime {
  mdxComponents: FeatureMdxComponents
  pageTreePlugins: LoaderPlugin[]
  layoutData: FeatureLayoutDataLoader[]
  layoutTops: FeatureLayoutTop[]
}

/**
 * 建站器生成的 app/features/runtime.generated.ts 调它：键是功能名，值是那个功能的 feature.tsx（import * as）。
 * 两个功能导出了同名的 MDX 组件时报错，不让后一个悄悄盖掉前一个
 */
export function siteFeatureRuntime(features: Readonly<Record<string, FeatureRuntimeModule>>): SiteFeatureRuntime {
  const mdxComponents: Record<string, FeatureMdxComponents[string]> = {}
  const ownerOfComponent = new Map<string, string>()
  const runtime: SiteFeatureRuntime = { mdxComponents, pageTreePlugins: [], layoutData: [], layoutTops: [] }
  for (const [feature, featureModule] of Object.entries(features)) {
    for (const [tag, component] of Object.entries(featureModule.mdxComponents ?? {})) {
      const owner = ownerOfComponent.get(tag)
      if (owner !== undefined) throw new Error(`功能 ${owner} 与 ${feature} 的 feature.tsx 都导出了 MDX 组件 ${tag}：改掉其中一个的名字`)
      ownerOfComponent.set(tag, feature)
      mdxComponents[tag] = component
    }
    runtime.pageTreePlugins.push(...(featureModule.pageTreePlugins ?? []))
    const { layoutData, LayoutTop } = featureModule
    if (layoutData !== undefined) runtime.layoutData.push({ feature, load: (args, base) => layoutData.call(featureModule, args, base) })
    if (LayoutTop !== undefined) runtime.layoutTops.push({ feature, Component: LayoutTop })
  }
  return runtime
}
