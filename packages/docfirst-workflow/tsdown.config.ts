import { defineConfig } from "tsdown";

export default defineConfig({
  /**
   * 四个入口，产物一律落 `dist/` 一层深。
   *   index  `.` 出口：命令行的 main、项目装配、读卡目录
   *   cli    bin `docfirst`，只递参数与退出码
   *   mdx    `./mdx` 出口：mdx 格式，项目的 docfirst.config.mjs 与 `@godcreator/docfirst-fumadocs` import 它
   *   cards  `./cards` 出口：只有读卡目录。站的星轨盘页经 `@godcreator/docfirst-fumadocs/trajectory` 用它；
   *          走 `.` 会把命令行与配置加载一起带进 Next 的服务端构建，Turbopack 分析其中按路径读盘的代码时报警告，
   *          Next 16.3.5 截断警告里的中文源码片段会崩溃
   * 钉码与轨迹两个兄弟包是 dependencies，tsdown 默认不打进产物，运行时按包名加载。
   */
  entry: {
    index: "src/index.ts",
    cli: "src/cli/cli.ts",
    mdx: "src/mdx/index.ts",
    cards: "src/project/card-dir.ts",
  },
  format: ["esm"],
  platform: "node",
  dts: true,
  clean: true,
});
