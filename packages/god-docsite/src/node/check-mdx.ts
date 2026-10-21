import { readFile } from 'node:fs/promises'
import { compile } from '@mdx-js/mdx'
import remarkMath from 'remark-math'
import { externalMdxSourceOf, remarkExternalPageRules } from './external-mdx-source.js'

export type MdxCheck = { ok: true } | { ok: false; message: string }

/**
 * 外部 mdx 文件编译过不过，不过时带编译器原话（行列号对得上原文件）：frontmatter、MDX 语法、import、越出 rootDir 的图片地址。
 * 站点不用在运行：只用 mdx 编译器与 remark-math，不加载站点的插件与组件表，所以查不出组件名写错
 */
export async function checkMdx(file: string, { rootDir }: { rootDir: string }): Promise<MdxCheck> {
  const parsed = externalMdxSourceOf(await readFile(file, 'utf8'))
  if ('message' in parsed) return { ok: false, message: parsed.message }
  try {
    await compile(parsed.body, { outputFormat: 'function-body', remarkPlugins: [remarkMath, remarkExternalPageRules(file, { rootDir, assetsHrefOf: (relative) => relative })] })
    return { ok: true }
  } catch (error) {
    return { ok: false, message: String(error) }
  }
}
