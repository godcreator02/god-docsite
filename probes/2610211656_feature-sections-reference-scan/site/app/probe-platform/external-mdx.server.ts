// 原型：外部文件夹里一页 mdx 的请求时编译（照 papers-reading 的 compile.ts 简化：没有图片路径改写）
import { readFile, stat } from 'node:fs/promises'
import { compile } from '@mdx-js/mdx'
import { frontmatter } from 'fumadocs-core/content/md/frontmatter'
import { mdxPreset } from 'fumadocs-core/content/mdx/preset-runtime'
import rehypeKatex from 'rehype-katex'
import remarkMath from 'remark-math'

export type ExternalMdxResult = { state: 'ready'; title: string; code: string } | { state: 'broken'; message: string } | { state: 'missing' }

const compiledByFile = new Map<string, { mtimeMs: number; size: number; result: ExternalMdxResult }>()

async function compileSource(source: string): Promise<ExternalMdxResult> {
  const parsed = frontmatter(source)
  const title = (parsed.data as { title?: unknown } | null)?.title
  if (typeof title !== 'string') return { state: 'broken', message: 'frontmatter 里缺少 title' }
  try {
    const options = await mdxPreset({
      development: false,
      remarkImageOptions: false,
      remarkStructureOptions: false,
      remarkHeadingOptions: { generateToc: true },
      remarkPlugins: [remarkMath],
      rehypePlugins: (plugins) => [rehypeKatex, ...plugins],
    })
    return { state: 'ready', title, code: String(await compile(parsed.matter.replace(/[^\n]/g, '') + parsed.content, options)) }
  } catch (error) {
    return { state: 'broken', message: String(error) }
  }
}

export async function compileExternalMdx(file: string | undefined): Promise<ExternalMdxResult> {
  if (file === undefined) return { state: 'missing' }
  const info = await stat(file).catch((error: NodeJS.ErrnoException) => {
    if (error.code === 'ENOENT') return undefined
    throw error
  })
  if (info === undefined) return { state: 'missing' }
  const cached = compiledByFile.get(file)
  if (cached !== undefined && cached.mtimeMs === info.mtimeMs && cached.size === info.size) return cached.result
  const result = await compileSource(await readFile(file, 'utf8'))
  compiledByFile.set(file, { mtimeMs: info.mtimeMs, size: info.size, result })
  return result
}
