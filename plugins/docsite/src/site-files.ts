import path from 'node:path'
/**
 * 不经开发服务、直接读站点目录里的文件（组合层不再提供这批工具，插件自己读）：
 * 人员表在 @godcreator/docsite-identity、评论在 @godcreator/docsite-comments、站名与 MDX 检查在这里
 */
import { readCommentThreads } from '@godcreator/docsite-comments/server'

export { siteTitleOf } from './site-title.js'

/**
 * 评论文件的问题清单：读不出评论目录（形状错、frontmatter 缺字段）就是问题；
 * 空数组 = 没问题
 */
export async function siteProblems(siteDir: string): Promise<string[]> {
  try {
    await readCommentThreads(path.join(siteDir, 'comments'))
    return []
  } catch (error) {
    return [error instanceof Error ? error.message : String(error)]
  }
}

