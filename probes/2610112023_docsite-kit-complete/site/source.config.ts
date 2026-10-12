import { applyMdxPreset, defineConfig, defineDocs } from 'fumadocs-mdx/config';
import { nodeMarkerRemark } from './app/lib/node-marker-remark';

// 全局配置只放共同设置；按集合的编译期插件写在各命名集合的 mdxOptions 里。
// 这个文件只在构建期由 Node 加载：Node-only 插件可以在这里静态 import。
// 评论不走这里的集合：评论文件由 api-comments 写、由 loader 每次请求时读盘并编译（app/lib/comment-data.server.ts），
// 不经过 Fumadocs 的 codegen 与集合 glob。
export default defineConfig({});

export const collectionA = defineDocs({
  dir: 'content/collection-a',
  docs: {
    mdxOptions: applyMdxPreset({
      remarkPlugins: [[nodeMarkerRemark, { marker: 'A-ONLY-NODE-COMPILED' }]],
    }),
  },
});

export const collectionB = defineDocs({
  dir: 'content/collection-b',
  docs: {
    mdxOptions: applyMdxPreset({ remarkPlugins: [] }),
  },
});

// 评论示例页的正文：选中文字批注、折叠内容定位、元素批注的样本都在这一页
export const collectionDemo = defineDocs({
  dir: 'content/collection-demo',
  docs: {
    mdxOptions: applyMdxPreset({ remarkPlugins: [] }),
  },
});
