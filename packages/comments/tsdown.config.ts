import { defineConfig } from "tsdown";

// 四个入口对应 package.json 的四个出口：site 进浏览器，只从 core 取东西；node/ 只经 site/server 与 node 出口出去
export default defineConfig({
  entry: {
    "core/index": "src/core/index.ts",
    "node/index": "src/node/index.ts",
    "site/index": "src/site/index.ts",
    "site/server": "src/site/index.server.ts",
  },
  format: ["esm"],
  platform: "node",
  dts: true,
  clean: true,
});
