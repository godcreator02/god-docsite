import { Accordion, Accordions } from '@fumadocs/base-ui/components/accordion'
import { Banner } from '@fumadocs/base-ui/components/banner'
import { File, Files, Folder } from '@fumadocs/base-ui/components/files'
import { ImageZoom } from '@fumadocs/base-ui/components/image-zoom'
import { InlineTOC } from '@fumadocs/base-ui/components/inline-toc'
import { Step, Steps } from '@fumadocs/base-ui/components/steps'
import { Tab, Tabs } from '@fumadocs/base-ui/components/tabs'
import { TypeTable } from '@fumadocs/base-ui/components/type-table'
import { Term } from './term.js'

/**
 * MDX 正文不用 import 就能写的平台组件：fumadocs 的排版组件、术语标注的 Term，图片换成点了能放大的 ImageZoom。
 * 站点的 mdx-components 把它与 @fumadocs/base-ui/mdx 的默认组件、站内链接 a、功能包的组件合在一起
 */
export const siteMdxComponents = { Accordion, Accordions, Banner, File, Files, Folder, InlineTOC, Step, Steps, Tab, Tabs, TypeTable, Term, img: ImageZoom }
