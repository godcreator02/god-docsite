/**
 * 不经开发服务、直接读站点目录里的文件：gwb 插件（gwb-docsite、gwb-collab）在 Node 里用。
 * 身份与人员表在 @godcreator/docsite-identity，评论在 @godcreator/docsite-comments，
 * 这里只留组合层需要的读取与检查
 */
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { readCommentThreads } from '@godcreator/docsite-comments/server'
import { sitePeople } from '@godcreator/docsite-identity/server'

export { sitePeople }
export { jsonFileOf, siteTitleOf } from './site-title.js'

/**
 * 评论文件的问题清单：读不出评论目录（形状错、frontmatter 缺字段）就是问题；
 * 作者是否在人员表由读的人核对（listComments 里做）。空数组 = 没问题
 */
export async function siteProblems(siteDir: string): Promise<string[]> {
  try {
    await readCommentThreads(path.join(siteDir, 'comments'))
    return []
  } catch (error) {
    return [error instanceof Error ? error.message : String(error)]
  }
}

/**
 * 编译站点 dirs 下的 MDX（如 ['content', 'comments']），回每个编不过的文件一句话；提交前查，打开站点前不查（要几秒）。
 * 编译器和公式插件在站点自己装的基础包里（dist/server/mdx-problems.js），规则和站点用的同一版
 */
export async function siteMdxProblems(siteDir: string, dirs: readonly string[]): Promise<string[]> {
  const compilerModule = path.join(siteDir, 'node_modules', '@godcreator', 'docsite-kit', 'dist', 'server', 'mdx-problems.js')
  const { mdxProblemsIn } = (await import(pathToFileURL(compilerModule).href)) as typeof import('./mdx-problems.js')
  return mdxProblemsIn(siteDir, dirs)
}
