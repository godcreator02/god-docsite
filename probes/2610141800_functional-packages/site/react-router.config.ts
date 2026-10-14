import type { Config } from '@react-router/dev/config';
import { glob } from 'node:fs/promises';
import { createGetUrl, getSlugs } from 'fumadocs-core/source';
import { getPageImageUrl } from './app/lib/shared';

const getUrl = createGetUrl('/docs');

// 官方模板把 getStaticPaths() 全部预渲染。功能包的页面要读写数据（预渲染出的 .data 是构建时的旧数据），
// 推送路由是不结束的长连接（预渲染等到超时、构建失败），所以只预渲染站点自己的静态页与内容页
const siteStaticPaths = ['/', '/llms.txt', '/llms-full.txt'];

export default {
  ssr: true,
  async prerender() {
    const paths: string[] = [...siteStaticPaths];
    // 对照：把功能包的数据页也预渲染，看 build+start 下 useFetcher 提交后数据还更不更新
    if (process.env.PROBE_PRERENDER_FEATURE_PAGE === '1') paths.push('/demo');

    for await (const entry of glob('**/*.mdx', { cwd: 'content/docs' })) {
      const slugs = getSlugs(entry);

      paths.push(getUrl(slugs));
      paths.push(getPageImageUrl({ slugs }).url);
    }

    return paths;
  },
} satisfies Config;
