import { loader } from 'fumadocs-core/source';
import { docs } from '../../.source/server';

// 服务端入口（Config API 生成的 .source/server）：
// 评论实验页（/page）与正文基线页（/docs/*）各用一个 source 实例（baseUrl 不同）。
// 浏览器一侧的按需正文入口见 lib/content-components.tsx。
export const source = loader({
  source: docs.toFumadocsSource(),
  baseUrl: '/page',
});

export const docsSource = loader({
  source: docs.toFumadocsSource(),
  baseUrl: '/docs',
});
