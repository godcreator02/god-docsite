用户最新明确指令：“node --test 全部用vitest啊，不要搞这种test”。这覆盖原L派单中的node:test要求。立即将本任务所有自动化测试统一到Vitest；已写的node:test/node:assert测试迁到vitest describe/it/expect，删除或停用本任务自己新建的node --test入口，不能保留第二套测试框架。CLI的正常node运行不受影响，只有测试框架改为Vitest。
K仍独占root lock与共享安装，本轮仍不创建package.json、不执行pnpm（exec会隐式install）。你可以直接调用已安装的 D:\unitfolders\oz47p-docsite-kit\docsite-kit\packages\docsite-kit\node_modules\.bin\vitest.ps1 来对自己目标目录运行Vitest（前面身份包已这样成功验证）；不改该工具所在包。测试临时目录和输出仍限你的create-core范围，实际文件IO的验收项目不减少。若类型解析缺依赖，先跑真实Vitest并如实说明静态类型缺口，不能回退node --test或假造通过。
其他范围照原派单和单一模板目录纠偏执行；README/result/handoff也统一使用Vitest命令。
