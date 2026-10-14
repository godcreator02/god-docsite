import type { LoaderPlugin } from 'fumadocs-core/source';

export interface DemoPageTreeEntry {
  name: string;
  url: string;
}

// 往页面树根部追加一个链接项；入口的名字与地址由站点传入（地址要和 routes.ts 里声明的一致）
export function demoPageTreePlugin(entry: DemoPageTreeEntry): LoaderPlugin {
  return {
    name: 'demo-pages:sidebar-entry',
    transformPageTree: {
      root(root) {
        root.children.push({ type: 'page', name: entry.name, url: entry.url, $id: 'demo-pages:sidebar-entry' });
        return root;
      },
    },
  };
}
