/**
 * 不经开发服务、直接读站点目录里的文件：gwb 插件（gwb-docsite、gwb-collab）在 Node 里用。
 * 不引用评论接口那一份（它带着 MDX 编译器），插件打包时不把它带进去
 */
import path from 'node:path'
import { pathToFileURL } from 'node:url'

export { commentThreadIdsAbout, readCommentThreads, siteProblems, type CommentFile, type CommentThreadFile } from './comment-files.js'
export { jsonFileOf, sitePeople } from './site-people.js'
export { siteTitleOf } from './site-title.js'

/**
 * 编译站点 dirs 下的 MDX（如 ['content', 'comments']），回每个编不过的文件一句话；提交前查，打开站点前不查（要几秒）。
 * 编译器和公式插件在站点自己装的基础包里（dist/server/mdx-problems.js），规则和站点用的同一版
 */
export async function siteMdxProblems(siteDir: string, dirs: readonly string[]): Promise<string[]> {
  const compilerModule = path.join(siteDir, 'node_modules', '@godcreator', 'docsite-kit', 'dist', 'server', 'mdx-problems.js')
  const { mdxProblemsIn } = (await import(pathToFileURL(compilerModule).href)) as typeof import('./mdx-problems.js')
  return mdxProblemsIn(siteDir, dirs)
}
