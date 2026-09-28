import { defineConfig } from 'vitest/config'

/**
 * 测试只认插件根下的 `tests/`，`src/` 里不放用例。
 *
 * 「slow」标签：**凡实际启动子进程的用例必须加 slow 标签**（`pnpm build` / `pnpm pack` 那种）。
 * 日常 `pnpm test` 想跳过它们就加 `--tags-filter=!slow`。
 */
export default defineConfig({
  test: {
    include: ['tests/**/*.{spec,test}.{ts,tsx}'],
    testTimeout: 20_000,
    fileParallelism: false,
    tags: [
      {
        name: 'slow',
        description: '实际启动子进程的用例',
        timeout: 300_000,
      },
    ],
  },
})
