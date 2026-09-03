import { defineConfig } from "tsdown";

export default defineConfig({
  entry: ["src/index.ts", "src/pre.tsx"],
  format: ["esm"],
  platform: "node",
  dts: true,
  clean: true,
  // fumadocs 和 react 只是 peer——它们在 devDependencies 里只为编译和类型检查用；
  // 不写这一行 tsdown 会把 devDependencies 打进产物
  deps: { neverBundle: [/^react/, /^fumadocs/] },
});
