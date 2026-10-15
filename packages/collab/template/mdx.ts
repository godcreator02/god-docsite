import { applyMdxPreset, defineCollections } from 'fumadocs-mdx/config'
import { journalDirName, journalFileGlob } from '@godcreator/collab'
import { remarkCollabLinks } from '@godcreator/collab/mdx'

// 构建期文件，只经 source.config.ts 加载：不 import react 与组件

/** 进站点每个集合的 remark 插件：[文字](/tasks/<id>)、[](/calendar/<日期>)、[](repo:…) 换成记录链接、日志链接、repo: 链接组件 */
export const remarkPlugins = [remarkCollabLinks]

/** 日志页：站点目录下 journal/<日期>.mdx，一天一篇，正文按需加载；不进页面树，由 /calendar/<日期> 那一页显示 */
export const journal = defineCollections({
  type: 'doc',
  dir: journalDirName,
  files: [journalFileGlob],
  async: true,
  mdxOptions: applyMdxPreset({ remarkPlugins }),
})
