import { defineConfig } from "tsdown";

export default defineConfig({
  entry: { index: "src/core/index.ts", node: "src/node/index.ts" },
  format: ["esm"],
  platform: "node",
  dts: true,
  clean: true,
});
