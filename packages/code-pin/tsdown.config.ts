import { defineConfig } from "tsdown";

export default defineConfig({
  entry: { index: "src/core/index.ts", node: "src/node/index.ts", site: "src/site/index.ts" },
  format: ["esm"],
  platform: "node",
  dts: true,
  clean: true,
  copy: [{ from: "src/site/pin.css", to: "dist" }],
});
