import { defineConfig } from "tsdown";

export default defineConfig({
  entry: {
    core: "src/core/index.ts",
    node: "src/node/index.ts",
    site: "src/site/index.ts",
  },
  format: ["esm"],
  platform: "node",
  dts: true,
  clean: true,
  // 宿主（react 系、fumadocs 系）是可选 peer，用使用方装的那份，不许打进产物
  deps: { neverBundle: [/^react/, /^fumadocs/, /^@fumadocs\//] },
});
