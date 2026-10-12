import defaultMdxComponents from '@fumadocs/base-ui/mdx'
import { Accordion, Accordions } from '@fumadocs/base-ui/components/accordion'
import { Banner } from '@fumadocs/base-ui/components/banner'
import { File, Files, Folder } from '@fumadocs/base-ui/components/files'
import { ImageZoom } from '@fumadocs/base-ui/components/image-zoom'
import { InlineTOC } from '@fumadocs/base-ui/components/inline-toc'
import { Step, Steps } from '@fumadocs/base-ui/components/steps'
import { Tab, Tabs } from '@fumadocs/base-ui/components/tabs'
import { TypeTable } from '@fumadocs/base-ui/components/type-table'
import { Term } from '@godcreator/docsite-writing'
import { siteLinkComponent } from '@godcreator/docsite-ui'
import { featureSites } from '../site/ui'

/** fumadocs 的排版组件不用 import 就能写；术语是写作包的 Term，图片换成点了能放大的 ImageZoom */
const fumadocsComponents = { Accordion, Accordions, Banner, File, Files, Folder, InlineTOC, Step, Steps, Tab, Tabs, TypeTable, Term, img: ImageZoom }

/** 链接显示成带图标的小卡片，功能包登记的链接种类排在前面 */
const a = siteLinkComponent(featureSites.flatMap((feature) => feature.linkKinds ?? []))

/** MDX 页面与评论正文不用 import 就能写的组件：fumadocs 的、写作包的，加上各功能包的 */
export const mdxComponents = Object.assign({}, defaultMdxComponents, fumadocsComponents, { a }, ...featureSites.map((feature) => feature.mdxComponents ?? {})) as typeof defaultMdxComponents
