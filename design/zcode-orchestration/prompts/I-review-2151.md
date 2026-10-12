继续任务I，主会话已读实际src和公开exports，并独立运行正式4文件20测试，退出0。发现必须修正的契约缺口；只改你原来独占的packages/docsite-identity/及package-split/identity/，不得改J、站点、共享配置或lock。

src/server/write-access.ts中authorizeWrite两条成功路径直接return identity.person / person，但handoff声称返回均经publicPersonOf白名单投影。Person类型是结构化的，合法传入StoredPerson变量时codes会跟着返回。主会话实证在review/20261011-2151-authorize-projection.mjs及同名txt：当前身份返回codes和extra，agent返回extra，退出1。该脚本只读，不是要求你修改它。
请两条成功路径均经publicPersonOf投影，并添加真正覆盖这两种输入的正式回归测试：无as或null时identity.person是携带codes/extra的对象；as为合法agent时people中agent携带extra。断言返回仅id/name/gitea?/agent?，原输入不被修改。不要用identityOf预先投影后的输入来代替这些测试。原签名、Origin/无身份/as拒绝语义保持不变。

检查请直接调用已有node/tsc/vitest可执行文件，不用pnpm exec（本机包装器会隐式install并写共享lock）。J上轮报告已因pnpm exec发生安装并恢复lock；主会话本轮git status确认根package.json/pnpm-workspace.yaml/pnpm-lock.yaml干净。J仍在写，严禁并行共享install；可用的现有依赖直接跑测试和tsc --noEmit，缺项如实报。
主会话复跑vitest留下了正常缓存，勿误认其他人在修改你的实现。完成后更新自己result/handoff记录修正、实跑命令与退出码；不删除首次失败证据，不装依赖、不等待J、不轮询，不创建其他会话。由下一次15分钟定时检查读取。
