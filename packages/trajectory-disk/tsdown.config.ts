import { defineConfig } from "tsdown";

// 两个入口各一趟独立构建。合并成一趟的话，rolldown 的多入口会把两边共用的代码（画布、序列化）
// 拆进一个共享 chunk，`./disk` 的 "use client" 只留在入口文件上，共享 chunk 没人标记——
// 分开构建，每份产物各自带齐自己用到的代码，disk.mjs 头一行的指令管得住它的全部内容。
// platform 用 node 只为了让产物落 .mjs 后缀（跟 package.json exports 对得上）——两个入口都不碰
// node 内置模块，node 平台不会给它们加任何 node 专属代码。
export default defineConfig([
  {
    entry: { index: "src/index.ts" },
    format: ["esm"],
    platform: "node",
    dts: true,
    clean: true,
  },
  {
    entry: { disk: "src/disk.tsx" },
    format: ["esm"],
    platform: "node",
    dts: true,
    deps: { neverBundle: [/^react/] },
  },
]);
