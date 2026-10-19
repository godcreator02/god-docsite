import rehypeKatex from 'rehype-katex'
import remarkMath from 'remark-math'
import { remarkGlossary } from '@godcreator/god-docsite/mdx'
import { featureRehypePlugins, featureRemarkPlugins, type SiteMdxPlugins } from '../features/mdx.generated.ts'

/** 不标术语的页：术语页规范那篇是人写的规范文本，里头的词按字面读 */
const glossaryFreePages = ['content/docs/human-write-spec-dont-change.mdx']
const isGlossaryFree = (file: string): boolean => glossaryFreePages.some((page) => file.replaceAll('\\', '/').endsWith(page))

/**
 * 全站的 remark / rehype 插件：source.config.ts 的页面集合与各功能的集合工厂都把它们并进自己的 applyMdxPreset。
 * 构建期才用（经 source.config.ts），不 import React 组件。
 * remark-math 排在最前：先让 $…$ 变成公式节点，功能的插件与术语标注才碰不到公式
 */
export const sitePlugins: SiteMdxPlugins = {
  remarkPlugins: [remarkMath, ...featureRemarkPlugins, remarkGlossary({ file: 'glossary.json', skipFile: isGlossaryFree })],
  rehypePlugins: [rehypeKatex, ...featureRehypePlugins],
}
