import { defineConfig } from 'vitest/config'

// 提交审核与同步的测试每个要运行二三十条 git 命令，Windows 上一条要零点几秒；
// 用到本地组织的测试每个先建三四个裸仓再克隆一遍（tests/fixtures/local-organization.ts），仓根四个包一起检查时 git 启动更慢
// pool 用 threads：全部测试文件共享一个进程，仓模板（tests/fixtures/local-organization.ts 的进程级缓存）只建一份
// __COLLAB_SITE_VERSION__ 在产物里由 build.ts 写进去，测试里给一个固定的
export default defineConfig({ define: { __COLLAB_SITE_VERSION__: JSON.stringify('0.0.0-test') }, test: { pool: 'threads', testTimeout: 60_000, hookTimeout: 90_000 } })
