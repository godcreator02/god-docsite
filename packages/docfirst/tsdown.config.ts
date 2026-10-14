import { defineConfig } from "tsdown";

export default defineConfig({
  entry: { index: "src/index.ts", bin: "src/bin.ts" },
  format: ["esm"],
  platform: "node",
  dts: true,
  clean: true,
});
