import { defineCollections, defineDocs } from 'fumadocs-mdx/config';

// 页面集合：async 让正文按需加载（loader 只取元数据，浏览器经 createClientLoader 取正文）
export const docs = defineDocs({
  dir: 'content/docs',
  docs: { async: true },
});

// 评论集合：一个评论一个文件夹，正文 MDX 与页面同一编译链
export const comments = defineCollections({
  type: 'doc',
  dir: 'comments',
  async: true,
});
