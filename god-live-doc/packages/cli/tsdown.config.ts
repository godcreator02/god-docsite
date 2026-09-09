import { defineConfig } from "tsdown";

export default defineConfig({
  entry: ["src/cli.ts", "src/run.ts", "src/init.ts"],
  format: ["esm"],
  platform: "node",
  dts: true,
  clean: true,
});
