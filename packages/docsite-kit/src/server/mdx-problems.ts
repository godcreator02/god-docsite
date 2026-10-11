import { readdir, readFile } from 'node:fs/promises'
import path from 'node:path'
import { compile } from '@mdx-js/mdx'
import rehypeKatex from 'rehype-katex'
import remarkMath from 'remark-math'

/** 文件开头的 frontmatter：换成同样多的空行再编译，报错的行号和文件里的对得上 */
const frontmatterPattern = /^---\r?\n[\s\S]*?\r?\n---(?=\r?\n|$)/

function withoutFrontmatter(source: string) {
  return source.replace(frontmatterPattern, (block) => block.replace(/[^\n]/g, ''))
}

async function markdownFilesUnder(dir: string): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true, recursive: true }).catch((error: NodeJS.ErrnoException) => {
    if (error.code === 'ENOENT') return []
    throw error
  })
  return entries.filter((entry) => entry.isFile() && /\.mdx?$/.test(entry.name)).map((entry) => path.join(entry.parentPath, entry.name))
}

type Place = { line?: number; column?: number }

function placeOf({ line, column }: Place) {
  return line === undefined ? '' : `第 ${line} 行第 ${column} 列：`
}

/**
 * 照骨架 source.config.ts 的公式设置编译一个文件，编不过回「第几行第几列：原话」。
 * rehype-katex 遇到写错的公式不抛错（页面上把原式标红），只往文件上记一条消息，所以也看它记的消息
 */
async function compileProblemOf(file: string): Promise<string | null> {
  const source = withoutFrontmatter(await readFile(file, 'utf8'))
  try {
    const compiled = await compile(source, { format: file.endsWith('.md') ? 'md' : 'mdx', remarkPlugins: [remarkMath], rehypePlugins: [rehypeKatex] })
    const formulaMessages = compiled.messages.filter((message) => message.source === 'rehype-katex')
    if (formulaMessages.length === 0) return null
    return formulaMessages.map((message) => `${placeOf(message)}公式排不出来：${message.cause instanceof Error ? message.cause.message : message.reason}`).join('；')
  } catch (error) {
    const { reason, message } = error as Place & { reason?: string; message: string }
    return `${placeOf(error as Place)}${reason ?? message}`
  }
}

/**
 * 编译站点 dirs 下的每个 .md、.mdx（不认得的组件不算错，那要渲染时才知道），回每个编不过的文件一句话。
 * gwb 插件不直接引用它（带着 MDX 编译器），经 ./files 的 siteMdxProblems 从站点装的基础包里加载
 */
export async function mdxProblemsIn(siteDir: string, dirs: readonly string[]): Promise<string[]> {
  const problems: string[] = []
  for (const dir of dirs) {
    for (const file of await markdownFilesUnder(path.join(siteDir, dir))) {
      const problem = await compileProblemOf(file)
      if (problem) problems.push(`${path.relative(siteDir, file).split(path.sep).join('/')} ${problem}`)
    }
  }
  return problems
}
