import { defineConfig } from "tsdown";

// 三个入口对应 package.json 的三个出口；site 只从 core 取东西，产物里不会带进 node/
export default defineConfig({
  entry: {
    "core/index": "src/core/index.ts",
    "node/index": "src/node/index.ts",
    "site/index": "src/site/index.ts",
  },
  format: ["esm"],
  platform: "node",
  dts: true,
  clean: true,
});
