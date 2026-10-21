import { readFile, stat } from 'node:fs/promises'
import { compile, type CompileOptions } from '@mdx-js/mdx'
import { mdxPreset } from 'fumadocs-core/content/mdx/preset-runtime'
import type { TOCItemType } from 'fumadocs-core/toc'
import { externalMdxSourceOf, remarkExternalPageRules, type ExternalAssetPlace } from '../node/external-mdx-source.js'
import type { ExternalMdx, SiteMdxPluginLists } from './external-mdx.js'

export interface ExternalMdxOptions extends ExternalAssetPlace {
  /** 站点上下文 mdxPlugins() 给的全站 remark / rehype 插件：外部页和内容页用同一套 */
  plugins: SiteMdxPluginLists
}

type CachedCompile = { mtimeMs: number; size: number; result: ExternalMdx }

type PluginList = NonNullable<CompileOptions['remarkPlugins']>

/** 键是 mdx 文件的绝对路径。不变式：同一个文件总是用同样的选项编译（同一个功能的同一条路由） */
const compiledByFile = new Map<string, CachedCompile>()

async function compileSource(file: string, source: string, options: ExternalMdxOptions): Promise<ExternalMdx> {
  const parsed = externalMdxSourceOf(source)
  if ('message' in parsed) return { state: 'broken', message: parsed.message }
  try {
    const compiled = await compile(
      parsed.body,
      await mdxPreset({
        development: false,
        remarkImageOptions: false,
        remarkStructureOptions: false,
        remarkHeadingOptions: { generateToc: true },
        remarkPlugins: [...options.plugins.remarkPlugins, remarkExternalPageRules(file, options)] as PluginList,
        rehypePlugins: options.plugins.rehypePlugins as PluginList,
      }),
    )
    return { state: 'ready', frontmatter: parsed.frontmatter, code: String(compiled), toc: compiled.data['toc'] as TOCItemType[] }
  } catch (error) {
    return { state: 'broken', message: String(error) }
  }
}

/**
 * 编译不在 content/ 里的一个 mdx 文件（论文的排版稿、资料的笔记、评论正文）：和内容页同一套插件，请求时编译，
 * 按「路径 + 修改时间 + 大小」缓存在开发服务进程里。写错了（frontmatter、MDX 语法、import、越界的图片地址）回 broken 带编译器原话；
 * 文件读不了照常抛出
 */
export async function compileExternalMdx(file: string, options: ExternalMdxOptions): Promise<ExternalMdx> {
  const { mtimeMs, size } = await stat(file)
  const cached = compiledByFile.get(file)
  if (cached !== undefined && cached.mtimeMs === mtimeMs && cached.size === size) return cached.result
  const result = await compileSource(file, await readFile(file, 'utf8'), options)
  compiledByFile.set(file, { mtimeMs, size, result })
  return result
}
