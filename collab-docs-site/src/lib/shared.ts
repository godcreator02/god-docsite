import { createGetUrl } from 'fumadocs-core/source';

export const appName = "协作站框架";
export const docsRoute = '/docs';
export const docsImageRoute = '/og/docs';
export const docsContentRoute = '/llms.mdx/docs';

/**
 * 现状区的各个分区：content/ 下的目录名就是网址前缀，机读版在 /llms.mdx/<目录> 下。
 * 加一个分区：这里加一项，src/lib/source.ts 加集合与 loader，src/app/<目录>/ 与 src/app/llms.mdx/<目录>/ 下各加一个路由文件
 */
export const currentZones = [
  { id: 'docs', title: '总览' },
  { id: 'collab-model', title: '数据模型包 collab-model' },
  { id: 'collab-site', title: '功能包 collab-site' },
  { id: 'collab-merge-check', title: '合并检查包 collab-merge-check' },
  { id: 'gwb-collab', title: '插件 gwb-collab' },
  { id: 'gitea', title: 'Gitea 与 NAS' },
  { id: 'cases', title: '使用案例' },
] as const;

export type CurrentZoneId = (typeof currentZones)[number]['id'];

export const zoneRoute = (zone: CurrentZoneId): string => `/${zone}`;
export const zoneContentRoute = (zone: CurrentZoneId): string => `/llms.mdx/${zone}`;

/** 一页机读版的地址；zone 是它所在的现状区分区 */
export function getPageMarkdownUrl(page: { slugs: string[]; locale?: string }, zone: CurrentZoneId = 'docs') {
  const segments = [...page.slugs, 'content.md'];

  return { segments, url: createGetUrl(zoneContentRoute(zone))(segments, page.locale) };
}

const getImageUrl = createGetUrl(docsImageRoute);

export function getPageImageUrl(page: { slugs: string[]; locale?: string }) {
  const segments = [...page.slugs, 'image.png'];

  return { segments, url: getImageUrl(segments, page.locale) };
}
