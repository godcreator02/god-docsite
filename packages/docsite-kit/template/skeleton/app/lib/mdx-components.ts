import defaultMdxComponents from '@fumadocs/base-ui/mdx'
import { featureSites } from '../site/ui'

/** MDX 页面与评论正文不用 import 就能写的组件：fumadocs 的排版组件，加上各功能包的 */
export const mdxComponents = Object.assign({}, defaultMdxComponents, ...featureSites.map((feature) => feature.mdxComponents ?? {})) as typeof defaultMdxComponents
