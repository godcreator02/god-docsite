import {
  DocsBody,
  DocsDescription,
  DocsPage,
  DocsTitle,
} from '@fumadocs/base-ui/layouts/docs/page';
import browserCollections from '../../.source/browser';
import { useMDXComponents } from '@/components/mdx';

/**
 * 浏览器一侧的按需正文入口（官方 createClientLoader / useContent）：
 * 服务端 loader 只传路径，正文组件在浏览器按路径异步加载。
 * 页面与评论各一个 client loader；评论正文同样经集合编译链（同目录 tsx/图片照常可用）。
 *
 * 已知未解决（证据与定性见 tests/repro/upstream-rr-server-hmr-remount.md）：
 * dev 下评论写文件后，.source/server.ts 重新生成使 SSR 模块图失效，React Router 的
 * react-router-server-change-trigger-client-hmr 会 reload 客户端 route 模块并重挂组件；
 * 客户端 HMR 边界拦不住（驱动在 SSR 侧）。本轮试验过的 client-store/草稿方案已按用户指示回退。
 */
export const docsContent = browserCollections.docs.createClientLoader({
  component({ frontmatter, toc, default: MDX }) {
    return (
      <DocsPage toc={toc}>
        <DocsTitle>{frontmatter.title}</DocsTitle>
        {frontmatter.description ? <DocsDescription>{frontmatter.description}</DocsDescription> : null}
        <DocsBody>
          <MDX components={useMDXComponents()} />
        </DocsBody>
      </DocsPage>
    );
  },
});

export const commentContent = browserCollections.comments.createClientLoader({
  id: 'comments',
  component({ default: MDX }) {
    return (
      <div data-comment-body>
        <MDX components={useMDXComponents()} />
      </div>
    );
  },
});
