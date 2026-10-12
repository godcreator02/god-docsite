import { loader } from 'fumadocs-core/source';
import { comments, docs } from '../../.source/server';

/**
 * 服务端入口（Config API 生成的 .source/server）：
 * 页面来源与评论集合都从这里取；浏览器一侧见 lib/client-content.tsx。
 * 评论集合不做模块顶层的全站分组——分组在路由 loader 里逐请求做（lib/comments.server.ts）。
 */
export const source = loader({
  source: docs.toFumadocsSource(),
  baseUrl: '/docs',
});

export const commentCollection = comments;
