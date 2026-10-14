import { defineConfig } from "vitest/config";

// 落点的测试在临时目录里建真 git 仓，Windows 上起子进程慢
export default defineConfig({
  test: {
    include: ["test/**/*.test.ts"],
    testTimeout: 20_000,
  },
});
