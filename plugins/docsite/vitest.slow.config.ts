import { configDefaults, defineConfig } from 'vitest/config'
import base from './vitest.config.ts'

// pnpm test:slow：只跑慢的一级 *.slow.test.ts，其余设置与 vitest.config.ts 相同
export default defineConfig({
  ...base,
  test: { ...base.test, include: ['tests/**/*.slow.test.ts'], exclude: configDefaults.exclude },
})
