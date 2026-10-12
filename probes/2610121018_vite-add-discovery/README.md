pnpm install && pnpm test
# 2610121018_vite-add-discovery：纯 Vite 复现「新增正文失效」并定位责任层

任务 U（2026-10-12）。在**不加载 Fumadocs / React Router / React** 的最小纯 Vite 8.3.4 样本上，
区分「watcher add 事件是否收到」与「import.meta.glob 集合是否失效更新」，回答 T
（`2610120354_official-react-router`）留下的「是 Vite 还是 Fumadocs 的问题」。

核心结果：**纯 Vite 完整复现，且只有相对 base 形态失效**。`import.meta.glob(['./**/*.txt'], { base: './../content', … })`
（fumadocs-mdx codegen 在 Windows 上生成的形态）在 dev 运行中新增文件不进入 glob 集合；
watcher add 正常到达，卡在 `vite:import-glob` 热更新匹配：`toAbsoluteGlob` 的相对 base 分支用
`node:path` 的 `posix.resolve` 解析 `D:/…` importer，产出不含盘符的假绝对 glob，匹配不了
watcher 事件文件。`base: '/content'`（B）与不用 base（C）两条对照全部正常。
结论、四层证据与机制见 `result.md`。

## 复跑（Windows、本目录下）

```sh
# 1) 隔离安装（自管 pnpm-workspace/lock，只写本目录 node_modules，不动父仓；
#    pnpm-workspace.yaml 已挂 patches/vite@8.3.4.patch，装上即为补丁版）
pnpm install

# 2) 全部实验（Vitest：路径层 + matcher 层 + A/B/C/D 四变体真实 createServer 集成；
#    D 变体为相对 base + 否定 glob）。测试自动探测已安装 vite 是原版还是补丁版，
#    套对应断言组，两组证据互不覆盖：
pnpm test                # 当前为补丁版 → 四变体全部成功（补丁对照）
pnpm run test:original   # 临时移除补丁跑原版基线（相对 base 类失效 / B、C 成功），结束后自动恢复补丁
#    注意：test:original 中途被杀会留下无补丁状态，重跑 pnpm install 即恢复

# 3) 独立对照小实验
node path-check.mjs       # posix/win32 resolve 对照（缺陷机制）
node patch-check.mjs      # posix.join 改法与 win32.resolve 的一致性（补丁依据）
node tinyglobby-check.mjs # 假 glob 在 tinyglobby 扫描下为何容错命中

# 4) 真实浏览器对照（可选；先确认 5540/5541 空闲；浏览器验证在原版 vite 下做过——
#    如需在补丁版重做，直接起服务即可，此时 A 也应自动更新）
node scripts/serve-variant.mjs variant-a 5540   # 原版：页面清单不更新；补丁版：自动更新
node scripts/serve-variant.mjs variant-b 5541   # 两种状态下都自动更新
# 浏览器分别打开 http://127.0.0.1:5540 与 :5541，向 cases/variant-*/content/ 写新 txt，
# 等 10 秒不刷新，对照 #glob-keys 文本；诊断事件每秒落 logs/serve-events-<变体>.json

# 5) 真实 fumadocs 站两阶段验证（probe 内复制的官方快照，依赖同 T；详见 result.md 7b）
#    当前安装即补丁版：直接起站，运行中向 content/docs/ 写新 mdx → 第 1 秒 200 + 索引链接
cd fumadocs-site
& .\node_modules\.bin\react-router.cmd dev --port 5540 --host 127.0.0.1
#    要复跑「原版失效」阶段：把 pnpm-workspace.yaml 里 patchedDependencies 两行注释掉，
#    pnpm install 后重启站再新增 mdx（29 次 404）；跑完取消注释恢复补丁并再 install
```

注意：测试会先清掉 `cases/*/content/added-*` 残留再跑，初始态只有 `initial-*.txt`。

## 目录

| 路径 | 内容 |
| --- | --- |
| `cases/variant-{a,b,c}/` | 三个最小 Vite 站点（index.html + src/main.js + content/*.txt），唯一差异是 import.meta.glob 的 base 写法 |
| `diag/diagnostics.mjs` | 只读诊断插件：watcher `all` 与插件 `hotUpdate`（pre/post 两个实例），记录不改行为 |
| `test/glob-add.test.mjs` | 全部实验：路径层、matcher 层、三变体集成；探测安装状态自动选原版/补丁断言组 |
| `patches/vite@8.3.4.patch` | 实验补丁：相对 base 分支 `posix.resolve`→`posix.join`（一行；未测场景见 result.md 7a） |
| `fumadocs-site/` | T 官方快照 25 文件 + 依赖适配（同 T 版本）+ probe 内复制的最小 fumadocs 站；两阶段验证见 result.md 7b（logs/fumadocs-dev-{original,patched}.log） |
| `scripts/test-original.mjs` | 原版基线复跑：临时移补丁→跑→finally 恢复，只动本 probe 的配置与 lock |
| `path-check.mjs` | node:path posix/win32 对照（复现 toAbsoluteGlob 假路径） |
| `patch-check.mjs` | posix.join 改法与 win32.resolve 的一致性验证 |
| `tinyglobby-check.mjs` | 假 glob 在 tinyglobby 扫描下容错命中的实测（解释「初始正常」） |
| `scripts/serve-variant.mjs` | 真实 http dev server（浏览器验证用），事件每秒 dump |
| `logs/` | install.log、vitest.log（原版三轮）、vitest-original.log（原版基线复跑）、vitest-patched.log（补丁对照）、serve-{a,b}.log、serve-events-*.json、events-variant-*.json、vite-history/（vite 5/6/7 tarball 对照） |
| `result.md` | 分节结果与机制说明（第 7a 节为实验补丁验证） |
| `handoff.json` | 交接摘要 |

## 版本基线（实测）

node v24.14.1、Windows 10.0.26200 x64、pnpm 12.4.2；
vite 8.3.4、vitest 5.0.3（vitest 的 peer vite 同解析为 8.3.4）；tinyglobby 0.2.17、
picomatch（随 vite 8.3.4 依赖树，匹配器行为在测试内验证）。依赖只装在本目录，未升级任何现有包。

服务已停（5540/5541 无监听）；未提交、未发版、未发 issue、未归档；T 样本与其他 probe 只读引用。
