import { DocsBody, DocsDescription, DocsPage, DocsTitle } from '@fumadocs/base-ui/layouts/docs/page'
import browserCollections from '../../.source/browser'
import { mdxComponents } from './mdx-components'

/**
 * 浏览器一侧的按需正文入口（官方 createClientLoader / useContent）：
 * 服务端 loader 只传路径，正文组件在浏览器按路径异步加载。
 * 页面与评论各一个 client loader；评论正文同样经集合编译链（同目录 tsx/图片照常可用）
 */
export const docsContent = browserCollections.docs.createClientLoader({
  component({ frontmatter, toc, default: MDX }) {
    return (
      <DocsPage toc={toc}>
        <DocsTitle>{frontmatter.title}</DocsTitle>
        {frontmatter.description ? <DocsDescription>{frontmatter.description}</DocsDescription> : null}
        <DocsBody>
          <MDX components={mdxComponents} />
        </DocsBody>
      </DocsPage>
    )
  },
})

export const commentContent = browserCollections.comments.createClientLoader({
  id: 'comments',
  component({ default: MDX }) {
    return (
      <div data-comment-body>
        <MDX components={mdxComponents} />
      </div>
    )
  },
})
