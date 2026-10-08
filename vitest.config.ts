import { defineConfig } from "vitest/config";

// 只收工作区级测试：plugins/docfirst 有自己的 vitest 配置，docs-site 的测试在站里跑
export default defineConfig({
  test: {
    include: ["tests/*.test.ts"],
    testTimeout: 20_000,
  },
});
