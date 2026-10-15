import { configDefaults, defineConfig } from 'vitest/config'

// 测试在临时目录里建站、起开发服务，文件并行会抢端口与 pnpm 存储：同仓不并行运行测试
// *.slow.test.ts 是慢的一级（真建站、装依赖、构建、起服务），默认不跑，只由 pnpm test:slow（vitest.slow.config.ts）跑
export default defineConfig({
  test: {
    fileParallelism: false,
    exclude: [...configDefaults.exclude, '**/*.slow.test.*'],
  },
})
