import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['test/*.test.ts'],
    // dev 与 build 集成测试各自起真实服务，串行、放宽超时
    testTimeout: 180000,
    hookTimeout: 300000,
    fileParallelism: false,
  },
});
