import { defineConfig } from "tsdown";

export default defineConfig({
  /**
   * 产物一律落 `dist/` 一层深。
   *   index  `.` 出口：命令行的 main、项目装配、读卡目录
   *   cli    bin `docfirst`，只递参数与退出码
   *   mdx    `./mdx` 出口：mdx 格式，项目的 docfirst.config.mjs 与 `./fumadocs` import 它
   *   cards  `./cards` 出口：docfirst 卡格式（读卡目录、解析、字段表、卡身份）。站的星轨盘页与卡集合经 `./fumadocs` 用它；
   *          走 `.` 会把命令行与配置加载一起带进 Next 的服务端构建，Turbopack 分析其中按路径读盘的代码时报警告，
   *          Next 16.3.5 截断警告里的中文源码片段会崩溃
   *   fumadocs             `./fumadocs` 出口：站的 src/lib/source.ts import 它
   *   fumadocs-roster      `./fumadocs/roster`：docfirst.config.mjs import 它，命令行也会加载，所以不许碰宿主
   *   fumadocs-pre / -term 两个含 React 的侧出口，各自独立——pre 那份的 "use client" 指令得留在产物头一行，
   *                        混进主出口就等于给整个模块加了客户端指令
   *   fumadocs-trajectory  `./fumadocs/trajectory`：读卡建模的 loadTrajectory，按包名转出 StarDisk
   */
  entry: {
    index: "src/index.ts",
    cli: "src/cli/cli.ts",
    mdx: "src/mdx/index.ts",
    cards: "src/cards/index.ts",
    fumadocs: "src/fumadocs/index.ts",
    "fumadocs-roster": "src/fumadocs/roster.ts",
    "fumadocs-pre": "src/fumadocs/pre.tsx",
    "fumadocs-term": "src/fumadocs/term.tsx",
    "fumadocs-trajectory": "src/fumadocs/trajectory.ts",
  },
  format: ["esm"],
  platform: "node",
  dts: true,
  clean: true,
  // fumadocs 与 react 只是 peer，在 devDependencies 里只为编译和类型检查；不写这一行 tsdown 会把 devDependencies 打进产物。
  // `src/fumadocs/` 按包名引用本包的 `.`、`./mdx`、`./cards` 与兄弟包，产物里也按包名加载：
  // 打进来的话 fumadocs 的产物会带上命令行代码，trajectory-disk/disk 头一行的 "use client" 也会丢
  deps: { neverBundle: [/^react/, /^fumadocs/, /^@godcreator\//] },
});
