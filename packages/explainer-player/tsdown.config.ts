import { defineConfig } from "tsdown";

// 三个入口各自独立构建：`./text` 与 `./seam-graph` 由站在 Node 里生成机读版时加载，不能带 "use client"，也不能 import react；
// 合成一次构建的话，共用的代码会被拆进共享 chunk，入口上的指令管不到它。
// platform 用 node 只为了让产物是 .mjs 后缀（跟 package.json 的 exports 对得上），三个入口都不碰 node 内置模块。
export default defineConfig([
  {
    entry: { index: "src/index.ts" },
    format: ["esm"],
    platform: "node",
    dts: true,
    clean: true,
    deps: { neverBundle: [/^react/] },
  },
  {
    entry: { text: "src/text.ts" },
    format: ["esm"],
    platform: "node",
    dts: true,
  },
  {
    entry: { "seam-graph": "src/seam-graph.ts" },
    format: ["esm"],
    platform: "node",
    dts: true,
  },
]);
