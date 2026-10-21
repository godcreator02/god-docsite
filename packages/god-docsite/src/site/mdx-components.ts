import { Accordion, Accordions } from '@fumadocs/base-ui/components/accordion'
import { Banner } from '@fumadocs/base-ui/components/banner'
import { File, Files, Folder } from '@fumadocs/base-ui/components/files'
import { InlineTOC } from '@fumadocs/base-ui/components/inline-toc'
import { Step, Steps } from '@fumadocs/base-ui/components/steps'
import { Tab, Tabs } from '@fumadocs/base-ui/components/tabs'
import { TypeTable } from '@fumadocs/base-ui/components/type-table'
import { Figure, FigureRow, FigureRowCaption } from './figure.js'
import { ImageZoom } from './image-zoom.js'
import { Term } from './term.js'

/**
 * MDX 正文不用 import 就能写的平台组件：fumadocs 的排版组件、术语标注的 Term、点了能放大的 ImageZoom（Markdown 图片也换成它）、带图注的图 Figure 与并排的 FigureRow、FigureRowCaption。
 * 站点的 mdx-components 把它与 @fumadocs/base-ui/mdx 的默认组件、站内链接 a、功能包的组件合在一起
 */
export const siteMdxComponents = { Accordion, Accordions, Banner, Figure, FigureRow, FigureRowCaption, File, Files, Folder, ImageZoom, InlineTOC, Step, Steps, Tab, Tabs, TypeTable, Term, img: ImageZoom }
