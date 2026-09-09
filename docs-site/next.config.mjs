import path from 'node:path';
import { createMDX } from 'fumadocs-mdx/next';

const withMDX = createMDX();

/** @type {import('next').NextConfig} */
const config = {
  reactStrictMode: true,
  // 包从同一个 pnpm 工作区拿，node_modules 里是指向站外的软链——root 抬到工作区根
  // （也就是仓根），那些软链的真身才在 Turbopack 视野里
  turbopack: { root: path.resolve(process.cwd(), '..') },
  /**
   * **空着，这一行就是那条「不许外置」的账。**
   *
   * 塌包之后 `@godcreator02/livedoc` 里同时住着服务端那半（读盘、调 git、remark 插件）
   * 与两个客户端组件（`/fumadocs/pre` 状态点、`/fumadocs/term` 术语），
   * `serverExternalPackages` 按包名匹配、没有子路径粒度，所以它整包不能外置：
   * 外置之后 Next 走 Node 单独加载、跟站打包的 React 分了家，预渲染报
   * `Cannot read properties of null (reading 'use')`。
   * trajectory 同理不外置，还多一层——它的 `./server` 用包名自引用去渲 `./react`，
   * 一外置连那句 `"use client"` 都发现不了。两条是同一类：**外置的边界会把客户端指令吃掉**。
   *
   * 不外置的代价只是 Turbopack 多打一遍服务端那半：那半只在构建期跑，进不了客户端束。
   */
  serverExternalPackages: [],
  // 站根落到现状区首页；六区各有各的基座，/docs 自己有 index.mdx，不再转走
  redirects: async () => [{ source: '/', destination: '/docs', permanent: true }],
};

export default withMDX(config);
