import { defineConfig } from 'vitest/config'

// 测试在临时目录里建站、起开发服务，文件并行会抢端口与 pnpm 存储：同仓不并行运行测试
export default defineConfig({
  test: {
    fileParallelism: false,
  },
})
