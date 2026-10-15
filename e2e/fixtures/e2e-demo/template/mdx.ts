import { applyMdxPreset, defineCollections } from 'fumadocs-mdx/config'
import { remarkDemoMark } from 'e2e-demo/mdx'

type MdxPluginList = Extract<NonNullable<NonNullable<Parameters<typeof applyMdxPreset>[0]>['remarkPlugins']>, unknown[]>

export const remarkPlugins = [remarkDemoMark]

/** 集合工厂：名字与功能包 package.json 的 godDocsite.collections 一致；全站插件要并进自己的 applyMdxPreset，集合写了 mdxOptions 全局的就不生效 */
export const collections = {
  e2eDemoNotes: (sitePlugins: { remarkPlugins: MdxPluginList; rehypePlugins: MdxPluginList }) =>
    defineCollections({
      type: 'doc',
      dir: 'e2e-demo-notes',
      async: true,
      mdxOptions: applyMdxPreset({
        remarkPlugins: sitePlugins.remarkPlugins,
        rehypePlugins: (list) => [...sitePlugins.rehypePlugins, ...list],
      }),
    }),
}
