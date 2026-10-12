import path from 'node:path'
import { defineConfig, defineDocs, type DocsCollection, type frontmatterSchema, type metaSchema } from 'fumadocs-mdx/config'

type HastNode = {
  type: string
  tagName?: string
  properties?: Record<string, unknown>
  position?: { start: { line: number } }
  children?: HastNode[]
}

const blockTags = new Set(['p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'li', 'table', 'pre', 'blockquote'])

function rehypeSourcePosition() {
  return (tree: HastNode, file: { path: string }) => {
    const relativePath = path.relative(process.cwd(), file.path).replaceAll('\\', '/')
    const visit = (node: HastNode) => {
      if (node.type === 'element' && node.tagName && blockTags.has(node.tagName) && node.position) {
        node.properties = { ...node.properties, 'data-src': `${relativePath}:${node.position.start.line}` }
      }
      node.children?.forEach(visit)
    }
    visit(tree)
  }
}

export const docs: DocsCollection<typeof frontmatterSchema, typeof metaSchema> = defineDocs({ dir: 'content/docs' })

export default defineConfig({
  mdxOptions: {
    rehypePlugins: (plugins) => [...plugins, rehypeSourcePosition],
  },
})
