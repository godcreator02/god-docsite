import { siteMdxProblems, siteProblems } from '@godcreator/docsite-kit/files'
import { journalProblemsOf } from './journal-files.js'

/**
 * 托管前、提交审核前在本机查的站点问题，每条一句给人看的话：基础包查的人员列表、评论格式与作者、评论快照，
 * 加上日志页的文件名。只查文件，很快；页面能不能编译见 collabSiteMdxProblems
 */
export async function collabSiteProblems(siteDir: string): Promise<string[]> {
  return [...(await siteProblems(siteDir)), ...journalProblemsOf(siteDir)]
}

/** 要编译检查的 MDX：内容页、评论、日志页 */
const mdxDirs = ['content', 'comments', 'journal'] as const

/** 只在提交审核前查（要几秒）：内容页、评论、日志页里编不过的 MDX，写错的公式也算；用站点自己装的基础包编译 */
export async function collabSiteMdxProblems(siteDir: string): Promise<string[]> {
  return siteMdxProblems(siteDir, mdxDirs)
}
