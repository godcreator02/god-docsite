import { defineCollections, defineDocs } from 'fumadocs-mdx/config';

/** 页面集合：async 让正文按需加载（loader 只取路径，浏览器经 createClientLoader 取正文） */
export const docs = defineDocs({
  dir: 'content/docs',
  docs: { async: true },
});

/** 评论集合：一个评论串一个文件夹，文件夹里允许 .tsx 与图片（M2：与页面同一编译链） */
export const comments = defineCollections({
  type: 'doc',
  dir: 'comments',
  async: true,
});
