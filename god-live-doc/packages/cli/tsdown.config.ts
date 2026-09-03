import { defineConfig } from "tsdown";

export default defineConfig({
  entry: ["src/cli.ts", "src/run.ts"],
  format: ["esm"],
  platform: "node",
  dts: true,
  clean: true,
});
