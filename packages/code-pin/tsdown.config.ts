import { defineConfig } from "tsdown";

// 一个入口：`.`。产物落 `dist/index.mjs`，platform 用 node 是因为要 node:crypto
export default defineConfig({
  entry: { index: "src/index.ts" },
  format: ["esm"],
  platform: "node",
  dts: true,
  clean: true,
});
