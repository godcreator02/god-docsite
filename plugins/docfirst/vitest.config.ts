import { defineConfig } from 'vitest/config'

/**
 * 测试只认插件根下的 `tests/`，`src/` 里不放用例。
 * 现在没有慢的一级；要加慢测试照仓根 AGENTS.md 的分级写成 `*.slow.test.ts`，同时加 `vitest.slow.config.ts` 与 `test:slow`。
 */
export default defineConfig({
  test: {
    include: ['tests/**/*.{spec,test}.{ts,tsx}'],
    testTimeout: 20_000,
    fileParallelism: false,
  },
})
