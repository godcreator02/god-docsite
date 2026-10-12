import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/*.test.ts'],
    // 端口固定（5470/5471），文件必须串行；dev/build 启动慢，超时放宽
    fileParallelism: false,
    testTimeout: 180_000,
    hookTimeout: 300_000,
  },
});
