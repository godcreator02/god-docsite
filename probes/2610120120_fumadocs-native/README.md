pnpm install && pnpm test

# 2610120120_fumadocs-native：Fumadocs 原生评论闭环（N 线）

按 Fumadocs 原生方式重写的第一个评论读写闭环：标准 Fumadocs + React Router 站点，
Config API 集合、`.source/server` 与 `.source/browser` 入口分离、官方 `createClientLoader` /
`useContent` 按需正文；一页正文 + 旁栏评论列表与编辑器（新建、回复、删回复、删串）。
覆盖层（正文内批注）不在本段，属于 O 线。

## 目录

| 位置 | 内容 |
| --- | --- |
| `site/` | 真实站点（隔离 workspace 成员，dev 5470 / start 5471） |
| `packages/comments-model/` | 纯评论模型：文件形状、分组、写入与删除；不 import 任何身份概念 |
| `tests/` | Vitest：模型单测（真实文件）、dev 写闭环（真实 HTTP）、只读 dev、build/start 快照；日志在 `tests/logs/` |

## 常用命令（都在本目录）

```sh
pnpm install          # 安装隔离 workspace（自己的 pnpm-lock.yaml）
pnpm test             # 全部测试（31 个，见 tests/vitest.config.ts）
pnpm check            # 两个包的 TypeScript 检查
pnpm dev              # dev 服务 http://127.0.0.1:5470（无身份码时只读）
pnpm build            # react-router build
pnpm start            # react-router-serve（默认 3000；测试用 PORT=5471 HOST=127.0.0.1）
```

可写 dev 服务（本机 PowerShell）：

```powershell
$env:DOCSITE_IDENTITY_CODE='probe-code-owner'; pnpm --filter probe-native-site dev
```

身份码对应 `site/people.json`：`probe-code-owner` → 站长（本人），`assistant` 是 agent 人员（写时用
`as` 署名）。没有身份码或码不认得时站点只读（界面与接口都拒写）。

## 版本基线

fumadocs-core / @fumadocs/base-ui 16.17.1、fumadocs-mdx 15.4.7、Vite 8.3.4、React Router 8.4.0
（react-router / @react-router/dev / node / serve 同版本）、React 19.3、tailwindcss 4.3、Vitest 5.0。
锁定写在 `site/package.json` 与根 `package.json`，自己的 `pnpm-lock.yaml`。

结论、证据与未完成项见 `result.md`；交接摘要见 `handoff.json`。
