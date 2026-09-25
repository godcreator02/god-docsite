import path from 'node:path';
import { createMDX } from 'fumadocs-mdx/next';

const withMDX = createMDX();

/** @type {import('next').NextConfig} */
const config = {
  reactStrictMode: true,
  // 包从同一个 pnpm 工作区拿，node_modules 里是指向站外的软链——root 设成工作区根
  // （也就是仓根），那些软链指向的真实目录才在 Turbopack 的范围里
  turbopack: { root: path.resolve(process.cwd(), '..') },
  /**
   * **必须空着：这两个包都不能外置。**
   *
   * `@godcreator/docfirst-workflow` 一个包里同时有服务端代码（读盘、调 git、remark 插件）
   * 与两个客户端组件（`/fumadocs/pre` 状态点、`/fumadocs/term` 术语），
   * `serverExternalPackages` 按包名匹配、不能只外置某个子路径，所以它整包不能外置：
   * 外置之后 Next 走 Node 单独加载、跟站打包的 React 不是同一份，预渲染报
   * `Cannot read properties of null (reading 'use')`。
   * trajectory 同样不外置，还多一层原因——它的 `./server` 用包名引用自己的 `./react`，
   * 一外置连那句 `"use client"` 都识别不到。两条是同一类问题：**外置会让客户端指令失效**。
   *
   * 不外置的代价只是 Turbopack 多打包一遍服务端代码：那部分只在构建期运行，不进客户端产物。
   */
  serverExternalPackages: [],
  // 站根跳到现状区首页；三个区各有各的 URL 前缀，/docs 自己有 index.mdx
  redirects: async () => [{ source: '/', destination: '/docs', permanent: true }],
};

export default withMDX(config);
