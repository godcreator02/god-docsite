import { defineConfig } from "tsdown";

export default defineConfig({
  /**
   * 五个入口，产物一律落 `dist/` 一层深。
   *   index     `.` 出口：命令行的 main
   *   cli       bin `docfirst`，只递参数与退出码
   *   fumadocs  `./fumadocs` 出口：站的 source.config.ts import 它
   *   pre / term  两个含 React 的侧出口，各自独立——pre 那份的 "use client" 指令得留在产物头一行，
   *               混进 fumadocs 主出口就等于给整个模块加了客户端指令
   */
  entry: {
    index: "src/index.ts",
    cli: "src/cli/cli.ts",
    fumadocs: "src/fumadocs/index.ts",
    pre: "src/fumadocs/pre.tsx",
    term: "src/fumadocs/term.tsx",
  },
  format: ["esm"],
  platform: "node",
  dts: true,
  clean: true,
  // fumadocs 和 react 只是 peer——它们在 devDependencies 里只为编译和类型检查用；
  // 不写这一行 tsdown 会把 devDependencies 打进产物
  deps: { neverBundle: [/^react/, /^fumadocs/] },
});
