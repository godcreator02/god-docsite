import { defineConfig } from 'vitest/config';

// 覆盖层组件的测试要浏览器 DOM（jsdom）；模型测试只用纯函数与 node:fs，在 jsdom 下同样可跑。
// legacy/ 是拆包阶段的旧实现（不参与构建），不跑它的测试
export default defineConfig({
  test: {
    environment: 'jsdom',
    include: ['test/**/*.test.{ts,tsx}'],
  },
});
