import path from 'node:path';
import { createMDX } from 'fumadocs-mdx/next';

const withMDX = createMDX();

/** @type {import('next').NextConfig} */
const config = {
  reactStrictMode: true,
  // 包从同一个 pnpm 工作区拿，node_modules 里是指向站外的软链；轨迹卡目录
  // docs-god-flow/trajectory/ 又在工作区外、单元根里。root 抬到单元根，两者都圈进来
  turbopack: { root: path.resolve(process.cwd(), '..', '..') },
  // 这几个包只在服务端跑、还要读盘和调 git，标成外部包让 Node 自己解析。
  // trajectory 不放进来：它的 ./react 是客户端组件，server.tsx 内部用包名自引用渲它，
  // 外置会让 Next 走 Node 单独加载 server.mjs、发现不了 ./react 那份 "use client" 指令，
  // StarDisk 被当服务端组件渲染直接炸——跟 wiring.mdx 记的 format-fumadocs 那条一模一样。
  serverExternalPackages: [
    '@godcreator02/live-doc-format-fumadocs',
    '@godcreator02/live-doc-project',
    '@godcreator02/live-doc-core',
  ],
  // 站首页和 /docs 都落到人写的文档规范那页
  redirects: async () => [
    { source: '/', destination: '/docs/human-write-spec-dont-change', permanent: true },
    { source: '/docs', destination: '/docs/human-write-spec-dont-change', permanent: true },
  ],
};

export default withMDX(config);
