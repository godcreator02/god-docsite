pnpm install && node D:/unitfolders/00000-console/console/.claude/dev-timeout.mjs 120 "D:/unitfolders/oz47p-docsite-kit/docsite-kit/probes/2610120354_official-react-router/site" 'node_modules\.bin\react-router.cmd' dev --port 5530 --host 127.0.0.1

# 2610120354_official-react-router：原样官方 React Router 模板的 dev 新增正文验证

任务 T（2026-10-12）。原样运行官方 fumadocs `examples/react-router`
（提交 d6cfc48d62aa9ea413f0fc5033617c0c923681ec），只在 `site/content/docs/` 加测试内容，
验证 dev 运行中新增正文的行为。核心结果：**运行中新增的 MDX 不被已运行的 dev 服务发现
（客户端无 HMR 消息、服务端持续 404）；重启后同一页 200 且渲染完整**。
结论、证据与缺口见 `result.md`；来源、哈希与依赖适配见 `official-source.md`。

## 复跑（在 Windows、本目录下）

```sh
# 1) 安装（隔离 workspace，只写本目录的 lock 与 node_modules，不碰父仓）
pnpm install

# 2) 启动官方模板 dev（5530；120 分钟到点自动停整棵进程树）
node D:/unitfolders/00000-console/console/.claude/dev-timeout.mjs 120 \
  "D:/unitfolders/oz47p-docsite-kit/docsite-kit/probes/2610120354_official-react-router/site" \
  'node_modules\.bin\react-router.cmd' dev --port 5530 --host 127.0.0.1

# 3) 复现核心观察：服务运行中（不要重启）新写一个 mdx 到 site/content/docs/，
#    然后另开终端：
curl -s -o /dev/null -w "%{http_code}\n" http://127.0.0.1:5530/docs/<新文件名>
#    本轮实测：写入后 ~2 分钟内全部 404；重启 dev 后同一 URL 变 200。
#    不重启的 workaround（result.md 第 14 节，已验证）：新增/删除 MDX 后对
#    site/app/lib/source.ts 保存一次（内容不用改），约 3 秒内新页 200、索引同步。

# 裸 Vite 对照实验（无 RR / fumadocs；见 result.md 第 12 节）：
node D:/unitfolders/00000-console/console/.claude/dev-timeout.mjs 25 \
  "D:/unitfolders/oz47p-docsite-kit/docsite-kit/probes/2610120354_official-react-router/bare-vite" \
  'node_modules\.bin\vite.cmd' dev --port 5531 --host 127.0.0.1
#    打开 http://127.0.0.1:5531/ ，运行中往 bare-vite/src/pages/ 新增 .jsx：
#    本轮实测列表自动更新（裸 vite 的 glob 新增失效正常；另发现 base 参数被无视的独立 bug）。

# React Router 裸站对照实验（无 fumadocs；见 result.md 第 13 节）：
node D:/unitfolders/00000-console/console/.claude/dev-timeout.mjs 20 \
  "D:/unitfolders/oz47p-docsite-kit/docsite-kit/probes/2610120354_official-react-router/rr-vite-glob" \
  'node_modules\.bin\react-router.cmd' dev --port 5531 --host 127.0.0.1
#    运行中新增 app/pages/*.jsx：SSR HTML 约 9 秒内更新（正常）。
#    保存含 fumadocs 形态 glob 的 app/routes/_index.tsx：SSR 持续 500
#    （transport invoke timed out 60s）；重启恢复。该站是 vite/RR 层最小复现。

# 干净模板 + 插件验证（result.md 第 16 节）：
node D:/unitfolders/00000-console/console/.claude/dev-timeout.mjs 20 \
  "D:/unitfolders/oz47p-docsite-kit/docsite-kit/probes/2610120354_official-react-router/clean-fumadocs" \
  'node_modules\.bin\react-router.cmd' dev --port 5530 --host 127.0.0.1
#    官方快照原样副本（仅依赖适配 + vite.config.ts 插件两处改动）。
#    运行中往 clean-fumadocs/content/docs/ 新增 .mdx：约 0.16 秒自动 200、侧栏同步。
```

注意：`react-router.cmd` 的路径必须写反斜杠（cmd.exe 不认正斜杠相对路径），
这是本轮第一次启动失败的原因。

## 目录

| 路径 | 内容 |
| --- | --- |
| `official-snapshot/` + `official-snapshot.sha256` | 官方原样 25 文件与哈希基线 |
| `site/` | 工作副本：快照 + package.json 三处依赖适配 + 4 个测试文件 |
| `site/content/docs/baseline.mdx` 等 | 测试内容（TSX 计数器/输入、SVG、public PNG） |
| `vendor/` | 官方提交 tarball 原档 + sync.ts / mdx package.json 旁证 |
| `logs/` | install.log、dev-server.log（首次）、dev-server-restart.log（重启对照） |
| `result.md` | 分节结果（含未验证项与工具通道缺口） |
| `official-source.md` | 来源、接线、差异清单、隔离方式 |
| `handoff.json` | 交接摘要（时间线、状态、未完成场景） |

## 版本基线（实测解析）

fumadocs-core / @fumadocs/base-ui 16.17.1、fumadocs-mdx 15.4.7、react / react-dom 19.3.0、
react-router 全家 8.4.0、vite 8.3.4、tailwindcss 4.3.3、typescript 7.0.2。pnpm 12.4.2。

服务已停（5530 无监听）；未提交、未发版、未归档。
