import { currentSources } from '@/lib/source';
import { createSearchAPI } from 'fumadocs-core/search/server';

// 现状区各分区的页一起进搜索；轨迹与未来不进
export const { GET } = createSearchAPI('advanced', {
  indexes: () =>
    Object.values(currentSources).flatMap(({ source }) =>
      source.getPages().map((page) => ({
        id: page.url,
        title: page.data.title ?? page.url,
        description: page.data.description,
        url: page.url,
        structuredData: page.data.structuredData,
      })),
    ),
});
