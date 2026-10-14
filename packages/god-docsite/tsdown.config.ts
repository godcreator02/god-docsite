import { defineConfig } from "tsdown";

// 入口与 package.json 的出口一一对应：site/index 进浏览器，只从 core 取东西；node/ 只经 index.server 与构建期入口（vite、mdx）出去。
// 服务端入口的产物名以 .server.mjs 结尾，React Router 的 .server 检查才认得出它
export default defineConfig({
  entry: {
    "core/index": "src/core/index.ts",
    "vite/index": "src/vite/index.ts",
    "mdx/index": "src/mdx/index.ts",
    "site/index": "src/site/index.ts",
    "site/index.server": "src/site/index.server.ts",
    "site/tex": "src/site/tex-entry.ts",
  },
  format: ["esm"],
  platform: "node",
  dts: true,
  clean: true,
});
