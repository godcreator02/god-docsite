import path from 'node:path';
import { createMDX } from 'fumadocs-mdx/next';

const withMDX = createMDX();

/** @type {import('next').NextConfig} */
const config = {
  reactStrictMode: true,
  // 包是从 ../../god-live-doc/packages 用 link 拿的，node_modules 里是指向站外的软链。
  // Turbopack 只认它 root 以内的文件，所以 root 抬到单元根，把包工作区圈进来
  turbopack: { root: path.resolve(process.cwd(), '..', '..') },
  // 这几个包只在服务端跑、还要读盘和调 git，标成外部包让 Node 自己解析
  serverExternalPackages: [
    '@godcreator02/live-doc-format-fumadocs',
    '@godcreator02/live-doc-project',
    '@godcreator02/live-doc-core',
  ],
};

export default withMDX(config);
