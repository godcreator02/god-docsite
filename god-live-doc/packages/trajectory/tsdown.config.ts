import { defineConfig } from "tsdown";

// 三个入口各一趟独立构建。`./server` 用包名（而不是相对源路径）import `./react` 的 StarDisk：
// 独立构建之间没有共享 chunk，包名是裸标识符，tsdown 默认把它当外部依赖、原样留在产物里
// （不会尝试内联/拆分 react.tsx 的代码）——留着这行 verbatim 的 import，"use client" 才始终
// 钉在它唯一该在的文件（dist/react.mjs）头一行；Node 的包自引用（package.json name + exports）
// 在运行时把这个包名解回自己的 dist/react.mjs。若合并成一趟构建，rolldown 的多入口共享 chunk
// 会把 react.tsx 的代码拆进一个没人标记指令的私有 chunk，server 直接改吃那个 chunk、
// 两头都看不到 "use client" 边界（试过，见 tsdown.config.ts 的 git 历史）。
export default defineConfig([
  {
    entry: { index: "src/index.ts" },
    format: ["esm"],
    platform: "node",
    dts: true,
    clean: true,
  },
  {
    // platform 用 node 只为了让产物落 .mjs 后缀（跟 package.json exports 对得上）——
    // react.tsx 本身不碰任何 node 内置模块，node 平台不会给它加任何 node 专属代码。
    entry: { react: "src/react.tsx" },
    format: ["esm"],
    platform: "node",
    dts: true,
    deps: { neverBundle: [/^react/] },
  },
  {
    entry: { server: "src/server.tsx" },
    format: ["esm"],
    platform: "node",
    dts: true,
    deps: { neverBundle: [/^react/, /^@godcreator02\/live-doc-trajectory/] },
  },
]);
