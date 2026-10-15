import { defineConfig } from "tsdown";

export default defineConfig({
  entry: {
    "core/index": "src/core/index.ts",
    "site/index": "src/site/index.ts",
  },
  format: ["esm"],
  platform: "node",
  dts: true,
  clean: true,
});
