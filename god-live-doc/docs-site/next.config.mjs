import path from 'node:path';
import { createMDX } from 'fumadocs-mdx/next';

const withMDX = createMDX();

/** @type {import('next').NextConfig} */
const config = {
  reactStrictMode: true,
  // 包从同一个 pnpm 工作区拿，node_modules 里是指向站外的软链。
  // Turbopack 只认它 root 以内的文件，所以 root 抬到工作区根，把 packages/ 圈进来
  turbopack: { root: path.resolve(process.cwd(), '..') },
  // 这几个包只在服务端跑、还要读盘和调 git，标成外部包让 Node 自己解析
  serverExternalPackages: [
    '@god-live-doc/format-fumadocs',
    '@god-live-doc/project',
    '@god-live-doc/core',
  ],
};

export default withMDX(config);
