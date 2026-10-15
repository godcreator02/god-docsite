import { defineConfig } from "vitest/config";

// 报告页的渲染测试要 DOM（jsdom）的文件自己在头上写 @vitest-environment jsdom；其余在 Node 里跑
export default defineConfig({
  test: {
    include: ["test/**/*.test.{ts,tsx}"],
  },
});
