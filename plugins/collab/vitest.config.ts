import { defineConfig } from 'vitest/config'

// 提交审核与同步的测试每个要运行二三十条 git 命令，Windows 上一条要零点几秒；
// 用到本地组织的测试每个先建三四个裸仓再克隆一遍（tests/fixtures/local-organization.ts），仓根四个包一起检查时 git 启动更慢
// pool 用 threads：全部测试文件共享一个进程，仓模板（tests/fixtures/local-organization.ts 的进程级缓存）只建一份
// __COLLAB_VERSION__ 在产物里由 build.ts 写进去，测试里给一个固定的
export default defineConfig({ define: { __COLLAB_VERSION__: JSON.stringify('0.0.0-test') }, test: {
    pool: 'threads',
    testTimeout: 60_000,
    hookTimeout: 90_000,
    // tests/verified/ 是「已验证的行为假设」（整组织克隆、ahead/behind 语义、文件监视事件）：断言对着 git 与
    // watcher 本体，产品代码只是载体。默认不跑——只在四种信号下跑 pnpm test:verified：升 git 或关键依赖、
    // 动了它们的被测模块（src/organization/setup/、src/other-repos/fetch/）、发版前、用户或 agent 明确要求
    exclude: ['**/node_modules/**', '**/dist/**', 'tests/verified/**'],
  } })
