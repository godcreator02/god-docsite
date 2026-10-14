import { defineConfig } from "vitest/config";

// 浏览器定位的测试要 DOM（jsdom）；文件读写的测试在 jsdom 下同样能跑
export default defineConfig({
  test: {
    environment: "jsdom",
    include: ["test/**/*.test.{ts,tsx}"],
  },
});
