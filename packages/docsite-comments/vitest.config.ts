import { defineConfig } from 'vitest/config';

// 覆盖层组件的测试要浏览器 DOM（jsdom）；模型测试只用纯函数与 node:fs，在 jsdom 下同样可跑。
export default defineConfig({
  test: {
    environment: 'jsdom',
    include: ['test/**/*.test.{ts,tsx}'],
  },
});
