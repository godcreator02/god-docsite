import { defineConfig } from "tsdown";

export default defineConfig({
  // 建站那个模块的入口名字写死成 site：产物是 dist/site.mjs，跟包根隔一层——
  // 模板路径按 import.meta.url 往上找，摆深了就找不着了
  entry: { cli: "src/cli.ts", run: "src/run.ts", site: "src/site/index.ts" },
  format: ["esm"],
  platform: "node",
  dts: true,
  clean: true,
});
