import { readdir, readFile } from 'node:fs/promises'
import path from 'node:path'
import { createCompiler, parseFrontmatter } from '@fumadocs/mdx-remote'
import { executeMdxSync } from '@fumadocs/mdx-remote/client'
import { loader as createSourceLoader } from 'fumadocs-core/source'
import { useFumadocsLoader } from 'fumadocs-core/source/client'
import { DocsLayout } from 'fumadocs-ui/layouts/docs'
import { DocsBody, DocsPage, DocsTitle } from 'fumadocs-ui/layouts/docs/page'
import defaultMdxComponents from 'fumadocs-ui/mdx'
import type { Route } from './+types/remote'

/**
 * 方案 E：不用 fumadocs-mdx 集合，每次请求读 content/docs 目录、按 frontmatter 建页面树、
 * 用 @fumadocs/mdx-remote 现场编译这一页。新文件在下一次请求就可见，不依赖文件监视与 import.meta.glob
 */
const contentDir = path.resolve('content/docs')
const compiler = createCompiler()

async function readPages() {
  const files = (await readdir(contentDir, { recursive: true })).filter((file) => file.endsWith('.mdx')).map((file) => file.replaceAll('\\', '/'))
  return Promise.all(
    files.map(async (file) => {
      const raw = await readFile(path.join(contentDir, file), 'utf8')
      const { frontmatter } = parseFrontmatter(raw)
      return { file, raw, title: String((frontmatter as { title?: unknown }).title ?? file) }
    }),
  )
}

export async function loader({ params }: Route.LoaderArgs) {
  const pages = await readPages()
  const source = createSourceLoader({
    baseUrl: '/remote',
    source: { files: pages.map((page) => ({ type: 'page' as const, path: page.file, data: { title: page.title } })) },
  })
  const slugs = (params['*'] ?? '').split('/').filter((segment) => segment.length > 0)
  const page = source.getPage(slugs)
  if (!page) throw new Response('没有这一页', { status: 404 })
  const entry = pages.find((candidate) => candidate.file === page.path)!
  const compiled = await compiler.compileFile({ path: path.join(contentDir, entry.file), value: entry.raw })
  return { title: entry.title, compiled: String(compiled), pageTree: await source.serializePageTree(source.getPageTree()) }
}

export default function RemoteRoute({ loaderData }: Route.ComponentProps) {
  const { title, compiled, pageTree } = useFumadocsLoader(loaderData)
  const { default: Mdx } = executeMdxSync(compiled)
  return (
    <DocsLayout nav={{ title: '刷新实验站（请求时编译）' }} tree={pageTree}>
      <DocsPage>
        <title>{title}</title>
        <DocsTitle>{title}</DocsTitle>
        <DocsBody>
          <Mdx components={defaultMdxComponents} />
        </DocsBody>
      </DocsPage>
    </DocsLayout>
  )
}
