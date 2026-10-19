import { applyMdxPreset, defineCollections, type DefaultMDXOptions } from 'fumadocs-mdx/config'
import { journalDirName, journalFileGlob } from '@godcreator/collab'
import { remarkCollabLinks } from '@godcreator/collab/mdx'

// 构建期文件，只经 source.config.ts 加载：不 import react 与组件

type MdxPluginList = Extract<NonNullable<DefaultMDXOptions['remarkPlugins']>, unknown[]>

/** 站点的全站插件（公式、术语，以及各功能的 remarkPlugins）与代码高亮选项：建站器生成的集合汇总文件调用工厂时传入 */
interface SitePlugins {
  remarkPlugins: MdxPluginList
  rehypePlugins: MdxPluginList
  rehypeCodeOptions?: DefaultMDXOptions['rehypeCodeOptions']
}

/** 进站点每个集合的 remark 插件：[文字](/tasks/<id>)、[](/calendar/<日期>)、[](repo:…) 换成记录链接、日志链接、repo: 链接组件 */
export const remarkPlugins = [remarkCollabLinks]

/** 集合名单与 package.json 的 godDocsite.collections 一致；集合写了 mdxOptions，全局插件对它不生效，所以把全站插件并进来 */
export const collections = {
  /** 日志页：站点目录下 journal/<日期>.mdx，一天一篇，正文按需加载；不进页面树，由 /calendar/<日期> 那一页显示 */
  journal: (sitePlugins: SitePlugins) =>
    defineCollections({
      type: 'doc',
      dir: journalDirName,
      files: [journalFileGlob],
      async: true,
      mdxOptions: applyMdxPreset({
        remarkPlugins: sitePlugins.remarkPlugins,
        rehypePlugins: (list) => [...sitePlugins.rehypePlugins, ...list],
        rehypeCodeOptions: sitePlugins.rehypeCodeOptions,
      }),
    }),
}
