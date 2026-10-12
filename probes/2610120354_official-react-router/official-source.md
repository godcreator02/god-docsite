# 官方模板来源与安装适配

## 来源（可核验）

- 仓：fuma-nama/fumadocs（GitHub）
- 提交：`d6cfc48d62aa9ea413f0fc5033617c0c923681ec`（2026-10-09）
- 取得方式：`curl -L https://codeload.github.com/fuma-nama/fumadocs/tar.gz/d6cfc48d62aa9ea413f0fc5033617c0c923681ec`
  （原档 `vendor/fumadocs-d6cfc48.tar.gz`，47,250,040 字节，未改动）
- 提取范围：`examples/react-router` → `official-snapshot/`（25 个文件，SHA256 清单在 `official-snapshot.sha256`）
- 模板身份旁证：`vendor/evidence/sync.ts`（同提交的 `packages/create-app/scripts/sync.ts`）把
  `examples/react-router` 原样 copy 为 CLI `react-router` 模板（仅排除 node_modules/dist 等、`.gitignore` 改名），
  证实该 example 就是 `create-fumadocs-app` 的 react-router 模板来源
- 版本旁证：`vendor/evidence/mdx-package.json` 为同提交 `packages/mdx/package.json`，`fumadocs-mdx` 15.4.7

## 官方接线（全部原样保留，未改动）

| 文件 | 官方内容 |
| --- | --- |
| `app/lib/source.ts` | `defineDocs`（`fumadocs-mdx/macro`，`dir: 'content/docs'`，`docs.async: true`）+ `loader({ source: docs.toFumadocsSource() })` |
| `app/routes/docs.tsx` | 服务端 loader `source.getPage(slugs)` 返回 `path/pageTree`；`Content` 用 `docs.getPage(path)`、`use(page.load())` 读 toc、直接渲染 `page.body` |
| `vite.config.ts` | `plugins: [fumadocsMdx(), tailwindcss(), reactRouter()]`，无自建插件、无 `index.target` |
| `react-router.config.ts` | `ssr: true` + 按 `content/docs/**/*.mdx` 预生成路径（含 llms/og 辅助路由） |
| `app/root.tsx` / `app/routes.ts` | 官方原样（RootProvider、markdown 协商中间件、docs/* 路由表） |

哈希对照（2026-10-12 实测）：`site/` 与 `official-snapshot/` 25 个官方文件逐一比对，
**只有 `package.json` 不同**（见下）。`site/` 里另有 4 个自加测试文件与 dev 自动生成的 `.react-router/types/*`。

## 安装适配（唯一差异：site/package.json 三处 workspace 依赖）

官方 example 依赖用 workspace 协议（monorepo 内部指向）。替换规则与同提交
`packages/create-app/src/index.ts` 的 `replaceWorkspaceDeps` + `constants.ts` 完全等价
（workspace 依赖 → 源包当前精确版本；`fumadocs-ui` → `npm:@fumadocs/base-ui@<version>` 别名）：

| 官方写法 | 替换为 | 依据 |
| --- | --- | --- |
| `"fumadocs-core": "workspace:*"` | `"fumadocs-core": "16.17.1"` | 提交内 `packages/core` 版本 |
| `"fumadocs-mdx": "workspace:*"` | `"fumadocs-mdx": "15.4.7"` | 提交内 `packages/mdx` 版本 |
| `"fumadocs-ui": "workspace:@fumadocs/base-ui@*"` | `"fumadocs-ui": "npm:@fumadocs/base-ui@16.17.1"` | 提交内 `packages/base-ui`（`@fumadocs/base-ui` 16.17.1）+ CLI 别名规则 |

其余依赖保持官方范围写法不动（`react ^19.3.0`、`react-router ^8.4.0`、`vite ^8.3.2` 等）。

实际解析版本（`pnpm list --depth 0`，全部落在指定基线）：fumadocs-core 16.17.1、
fumadocs-ui→@fumadocs/base-ui 16.17.1、fumadocs-mdx 15.4.7、react/react-dom 19.3.0、
react-router/@react-router/node/serve/dev 8.4.0、vite 8.3.4、tailwindcss 4.3.3、typescript 7.0.2。

已知 peer 警告（非适配引入）：`@tanstack/devtools-vite@0.4.1`（官方模板自带依赖
`react-router-devtools@6.2.3` 的传递依赖）声明 peer `vite ^6||^7`，实装 8.3.4。pnpm 仅警告，安装与运行未受影响。

## 隔离方式

- probe 根自带 `pnpm-workspace.yaml`（`packages: ['site']`）与根 `package.json`：截断 pnpm 向上查找，
  `pnpm install` 只写 probe 内的 `pnpm-lock.yaml` 与 `node_modules/`
- 实测父仓 `docsite-kit/pnpm-lock.yaml` 未被触碰（install 前后 mtime 比对）
- 全程未用 default home 验插件、未发版、未提交

## 目录

| 路径 | 内容 |
| --- | --- |
| `official-snapshot/` | 官方原样 25 文件（哈希基线） |
| `official-snapshot.sha256` | 快照 SHA256 清单 |
| `site/` | 工作副本（= 快照 + package.json 三处适配 + 4 个测试文件） |
| `vendor/fumadocs-d6cfc48.tar.gz` | 官方提交原档 |
| `vendor/evidence/` | sync.ts、mdx-package.json（模板身份与版本旁证） |
| `vendor/extract/` | 解压中间产物（含 create-app 源码，供查证替换逻辑） |
| `logs/` | install.log、dev-server.log（首次运行）、dev-server-restart.log（重启对照） |
