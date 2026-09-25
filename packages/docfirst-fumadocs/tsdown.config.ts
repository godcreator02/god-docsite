import { defineConfig } from "tsdown";

export default defineConfig({
  /**
   * 五个入口，产物一律落 `dist/` 一层深。
   *   index       `.` 出口：站的 src/lib/source.ts import 它
   *   roster      `./roster`：docfirst.config.mjs import 它，命令行也会加载，所以不许碰宿主
   *   pre / term  两个含 React 的侧出口，各自独立——pre 那份的 "use client" 指令得留在产物头一行，
   *               混进主出口就等于给整个模块加了客户端指令
   *   trajectory  `./trajectory`：星轨盘的服务端组件
   */
  entry: {
    index: "src/index.ts",
    roster: "src/roster.ts",
    pre: "src/pre.tsx",
    term: "src/term.tsx",
    trajectory: "src/trajectory.tsx",
  },
  format: ["esm"],
  platform: "node",
  dts: true,
  clean: true,
  // fumadocs 和 react 只是 peer——它们在 devDependencies 里只为编译和类型检查用；不写这一行
  // tsdown 会把 devDependencies 打进产物。兄弟包按包名加载：trajectory/disk 的 "use client"
  // 靠它原样留在那份产物头一行，打进来就丢了
  deps: { neverBundle: [/^react/, /^fumadocs/, /^@godcreator\//] },
});
