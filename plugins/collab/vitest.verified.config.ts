import { defineConfig } from 'vitest/config'

// 只跑 tests/verified/（已验证的行为假设批）的配置：主配置把它们 exclude 在日常检查之外，
// 这个配置反过来只收它们——`pnpm test:verified`。跑它的四种信号写在主配置的注释里。
// __COLLAB_SITE_VERSION__ 在产物里由 build.ts 写进去，测试里给一个固定的（与主配置一致）
export default defineConfig({
  define: { __COLLAB_SITE_VERSION__: JSON.stringify('0.0.0-test') },
  test: {
    pool: 'threads',
    testTimeout: 90_000,
    hookTimeout: 90_000,
    include: ['tests/verified/**/*.test.ts'],
  },
})
