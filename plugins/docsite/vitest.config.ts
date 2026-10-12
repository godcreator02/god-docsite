import { defineConfig } from 'vitest/config'

// 测试共享盘上的 template/（派生产物）与临时目录，文件并行会撞车：同仓不并行运行测试
export default defineConfig({
  test: {
    fileParallelism: false,
    setupFiles: ['tests/prepare-template.ts'],
  },
})
