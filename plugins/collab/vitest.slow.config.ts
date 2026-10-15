import { defineConfig } from 'vitest/config'
import base from './vitest.config.ts'

// pnpm test:slow：只跑慢的一级 *.slow.test.ts（tests/verified/ 照旧只归 pnpm test:verified），其余设置与 vitest.config.ts 相同
export default defineConfig({
  ...base,
  test: { ...base.test, include: ['tests/**/*.slow.test.ts'], exclude: ['**/node_modules/**', '**/dist/**', 'tests/verified/**'] },
})
