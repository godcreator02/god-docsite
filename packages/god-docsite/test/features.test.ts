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
  it('合并各功能的 MDX 组件、页面树插件、链接种类、侧栏入口、layoutData 与 LayoutTop', async () => {
    const plugin = { name: 'demo' }
    const linkKind = { matches: () => false, Chip: Badge }
    const runtime = siteFeatureRuntime({
      demo: { mdxComponents: { Badge }, pageTreePlugins: [plugin], linkKinds: [linkKind], sidebarLinks: [{ name: '演示', url: '/demo', icon: null, order: 50 }], layoutData: (_args, site) => ({ dir: site.dir }), LayoutTop: Top },
      other: { sidebarLinks: [{ name: '其他', url: '/other', icon: null, order: 10 }] },
      empty: {},
    })
    expect(runtime.mdxComponents).toEqual({ Badge })
    expect(runtime.pageTreePlugins).toEqual([plugin])
    expect(runtime.linkKinds).toEqual([linkKind])
    expect(runtime.sidebarLinks).toEqual([
      { name: '其他', url: '/other', icon: null, order: 10 },
      { name: '演示', url: '/demo', icon: null, order: 50 },
    ])
    expect(runtime.layoutTops).toEqual([{ feature: 'demo', Component: Top }])
    expect(await withFeatureLayoutData({ siteName: '站' }, { loaders: runtime.layoutData, args, base })).toEqual({ siteName: '站', demo: { dir: '/site' } })
  })

  it('侧栏入口按 order 排，一样大时保持功能名的先后', () => {
    const { sidebarLinks } = siteFeatureRuntime({
      alpha: { sidebarLinks: [{ name: '甲', url: '/a', icon: null, order: 90 }] },
      beta: { sidebarLinks: [{ name: '乙', url: '/b', icon: null, order: 20 }] },
      gamma: { sidebarLinks: [{ name: '丙', url: '/c', icon: null, order: 20 }] },
    })
    expect(sidebarLinks.map((link) => link.url)).toEqual(['/b', '/c', '/a'])
  })

  it('没有功能时都是空的', () => {
    expect(siteFeatureRuntime({})).toEqual({ mdxComponents: {}, pageTreePlugins: [], linkKinds: [], sidebarLinks: [], layoutData: [], layoutTops: [] })
  })

  it('两个功能导出同名 MDX 组件时报错', () => {
    expect(() => siteFeatureRuntime({ a: { mdxComponents: { Badge } }, b: { mdxComponents: { Badge } } })).toThrow(/功能 a 与 b .*Badge/)
  })

  it('功能名与站点布局数据的键重名时报错', async () => {
    const runtime = siteFeatureRuntime({ siteName: { layoutData: () => 1 } })
    await expect(withFeatureLayoutData({ siteName: '站' }, { loaders: runtime.layoutData, args, base })).rejects.toThrow(/键 siteName/)
  })
})
