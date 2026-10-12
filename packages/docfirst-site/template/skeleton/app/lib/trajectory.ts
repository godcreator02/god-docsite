import { defineCollections } from 'fumadocs-mdx/macro'

/**
 * 轨迹卡：站点根下 trajectory/ 里的 .md 与 .mdx，目录要和 docfirst.config.mjs 的 trajectory 一致。
 * frontmatter 原样读出（卡写得对不对由 docfirst check 校验），正文按需加载。功能包 @godcreator/docfirst-site 的两条路由经 @site/lib/trajectory 读它
 */
export const trajectoryCards = defineCollections({ type: 'doc', dir: 'trajectory', async: true })
