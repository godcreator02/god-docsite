import path from 'node:path';
import { createMDX } from 'fumadocs-mdx/next';

const withMDX = createMDX();

/** @type {import('next').NextConfig} */
const config = {
  reactStrictMode: true,
  // 包是从 ../../god-live-doc/packages 用 link 拿的，node_modules 里是指向站外的软链；
  // 卡目录 cards/ 就在本站目录里，不需要跟 docs-site 一样抬到单元根
  turbopack: { root: path.resolve(process.cwd(), '..', '..') },
  // 这几个包只在服务端跑、还要读盘和调 git，标成外部包让 Node 自己解析。
  // trajectory 不放进来：它的 ./react 是客户端组件，server.tsx 内部用包名自引用渲它，
  // 外置会让 Next 走 Node 单独加载、看不到 "use client" 边界——跟 docs-site 那条一样
  serverExternalPackages: [
    '@godcreator02/live-doc-format-fumadocs',
    '@godcreator02/live-doc-project',
    '@godcreator02/live-doc-core',
  ],
  // 站根没有页面，直接送到文档树；盘就在 /docs 那一页上
  redirects: async () => [{ source: '/', destination: '/docs', permanent: true }],
};

export default withMDX(config);
