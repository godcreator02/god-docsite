import defaultMdxComponents from '@fumadocs/base-ui/mdx'
import { Accordion, Accordions } from '@fumadocs/base-ui/components/accordion'
import { File, Files, Folder } from '@fumadocs/base-ui/components/files'
import { ImageZoom } from '@fumadocs/base-ui/components/image-zoom'
import { Step, Steps } from '@fumadocs/base-ui/components/steps'
import { Tab, Tabs } from '@fumadocs/base-ui/components/tabs'
import { TypeTable } from '@fumadocs/base-ui/components/type-table'
import { Term } from '@probe/writing'

/**
 * MDX 页面不用 import 就能写的组件：锁定版 Fumadocs 公开组件原样登记，写作库只添 Term 一个。
 * 图片换成点了能放大的 ImageZoom；表格是 defaultMdxComponents 自带的 Table；
 * 代码块高亮由 source.config.ts 里 applyMdxPreset 的 rehypeCode 给
 */
export const mdxComponents = {
  ...defaultMdxComponents,
  Accordion,
  Accordions,
  File,
  Files,
  Folder,
  ImageZoom,
  Step,
  Steps,
  Tab,
  Tabs,
  TypeTable,
  img: ImageZoom,
  Term,
} as typeof defaultMdxComponents
