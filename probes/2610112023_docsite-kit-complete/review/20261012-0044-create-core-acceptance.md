# create-docsite 文件生成核心验收

2026-10-12 00:44 Asia/Shanghai，主会话独立复核。

- 实际源码确认独占创建生命周期为 openSync(wx)成功 → 登记所有权 → writeFileSync(fd) → finally closeSync。打开失败不纳入回滚。
- ensureDirChain 对顶层/仅子目录模板均登记自己创建的站点根，预存在目录不登记。
- packages/create-docsite 的 Vitest 34/34通过，tsc -p tsconfig.json通过。
- 主会话review/create-rollback.test.ts原件独立重跑2/2通过：部分写入失败无半文件残留；仅子目录模板失败后新站点根消失。
- 单一普通模板树；原有用户数据保留、已有站点拒绝、冲突预检、junction检查等沿用既有测试。

本次接受范围为文件生成核心与直接运行CLI。包manifest/bin/最终模板/插件接入尚未登记，不代表完整建站产品已交付。没有提交、推送或发布。
