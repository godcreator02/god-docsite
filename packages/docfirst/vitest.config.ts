import { configDefaults, defineConfig } from "vitest/config";

// 命令行的测试在临时目录里建真 git 仓，Windows 上起子进程慢
// *.slow.test.ts 是慢的一级，默认不跑，只由 pnpm test:slow（vitest.slow.config.ts）跑
export default defineConfig({
  test: {
    include: ["test/**/*.test.ts"],
    exclude: [...configDefaults.exclude, "**/*.slow.test.*"],
    testTimeout: 20_000,
  },
});
