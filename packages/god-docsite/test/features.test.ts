import type { LoaderFunctionArgs } from 'react-router'
import { describe, expect, it } from 'vitest'
import { withFeatureLayoutData } from '../src/site/feature-layout.server.js'
import { siteFeatureRuntime } from '../src/site/features.js'
import type { BaseSiteContext } from '../src/site/site-context.js'

const Badge = () => null
const Top = () => null
const base = { dir: '/site' } as unknown as BaseSiteContext
const args = {} as LoaderFunctionArgs

describe('siteFeatureRuntime', () => {
  it('合并各功能的 MDX 组件、页面树插件、layoutData 与 LayoutTop', async () => {
    const plugin = { name: 'demo' }
    const runtime = siteFeatureRuntime({
      demo: { mdxComponents: { Badge }, pageTreePlugins: [plugin], layoutData: (_args, site) => ({ dir: site.dir }), LayoutTop: Top },
      empty: {},
    })
    expect(runtime.mdxComponents).toEqual({ Badge })
    expect(runtime.pageTreePlugins).toEqual([plugin])
    expect(runtime.layoutTops).toEqual([{ feature: 'demo', Component: Top }])
    expect(await withFeatureLayoutData({ siteName: '站' }, { loaders: runtime.layoutData, args, base })).toEqual({ siteName: '站', demo: { dir: '/site' } })
  })

  it('没有功能时都是空的', () => {
    expect(siteFeatureRuntime({})).toEqual({ mdxComponents: {}, pageTreePlugins: [], layoutData: [], layoutTops: [] })
  })

  it('两个功能导出同名 MDX 组件时报错', () => {
    expect(() => siteFeatureRuntime({ a: { mdxComponents: { Badge } }, b: { mdxComponents: { Badge } } })).toThrow(/功能 a 与 b .*Badge/)
  })

  it('功能名与站点布局数据的键重名时报错', async () => {
    const runtime = siteFeatureRuntime({ siteName: { layoutData: () => 1 } })
    await expect(withFeatureLayoutData({ siteName: '站' }, { loaders: runtime.layoutData, args, base })).rejects.toThrow(/键 siteName/)
  })
})
