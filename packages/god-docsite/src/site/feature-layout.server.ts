import type { LoaderFunctionArgs } from 'react-router'
import type { FeatureLayoutDataLoader } from './features.js'
import type { BaseSiteContext } from './site-context.js'

export interface FeatureLayoutDataOptions {
  /** siteFeatureRuntime(...) 的 layoutData */
  loaders: readonly FeatureLayoutDataLoader[]
  args: LoaderFunctionArgs
  base: BaseSiteContext
}

/**
 * 布局 loader 的收尾：站点自己的布局数据并上各功能 layoutData 的结果（以功能名为键）。
 * 功能名和站点已有的键重名时报错：功能拿不到自己那份数据，站点的数据也被盖掉
 */
export async function withFeatureLayoutData<SiteData extends Record<string, unknown>>(
  siteData: SiteData,
  { loaders, args, base }: FeatureLayoutDataOptions,
): Promise<SiteData & Record<string, unknown>> {
  const merged: Record<string, unknown> = { ...siteData }
  const results = await Promise.all(loaders.map(async ({ feature, load }) => [feature, await load(args, base)] as const))
  for (const [feature, data] of results) {
    if (feature in merged) throw new Error(`功能 ${feature} 的布局数据要放在键 ${feature} 下，站点的布局数据里已经有这个键：改功能目录名或站点布局 loader 的键`)
    merged[feature] = data
  }
  return merged as SiteData & Record<string, unknown>
}
