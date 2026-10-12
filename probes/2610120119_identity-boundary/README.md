# 身份边界探针（任务 P）

在 `docsite-kit/probes/2610120119_identity-boundary/` 里运行：`pnpm install && pnpm build && pnpm check && pnpm sample:writable`（另开一个终端跑 `pnpm sample:readonly` 得到只读实例）。

## 这是什么

身份能力与宿主授权边界的重写收敛（并行重写批次 P，基线是 K 的 `packages/docsite-identity` 已验实现）。与基线的差别：

- **输入由宿主显式提供**：people 数据、身份码、可信 origin 都是参数，包不读 `process.cwd()`、不读 `process.env`（只导出环境变量名常量 `identityCodeEnvName` 供宿主接线用）。基线的 `siteIdentity(siteDir)`（自读盘 + 环境变量）拆成 `readPeopleFile(siteDir)` 与纯函数 `resolveIdentity(people, code)`，接线移到宿主。
- **判定不依赖任何环境标记**：不看 DEV / NODE_ENV，规则在任何环境一致（有测试钉住）。
- **as 的类型显式判定**：空字符串、非字符串（表单传文件、数字）明确 400；没登记的人 400；是人的 403；只有已登记的 agent 可以被代发。
- **React Router 资源路由形状的组合样本**：loader/action 接收标准 `Request` 返回 `Response`，接进 React Router v7 的 route 模块时函数体原样可用；样本用最小 Node http 驱动同一组函数，真实浏览器可操作。
- **身份包与评论包互不认识**：评论桩只收结构化的 `{ id, name }` 作者（不 import 身份包）；身份包也不依赖评论。K 基线里的 mentions 提及匹配属于评论线功能，不在本包范围。

从 K 基线复用（判定逻辑已验，不重造）：`parsePeople` 的 people.json 盘协议校验、`publicPersonOf` 白名单投影、按码找人的判定、`authorizeWrite` 的 Origin/as 规则矩阵、Avatar 的 id 色相算法。盘协议（people.json 的形状与码规则）未改。

## 目录

```
├── README.md            本文件
├── result.md            结果、证据与检查清单
├── handoff.json         结构化交接（改动、检查、导出、依赖、未完成、写入释放）
├── package.json         probe 独立 workspace 根（固定版本依赖，自己的 lock）
├── pnpm-workspace.yaml
├── check.log            最近一次 pnpm check 的完整输出
├── verification/        浏览器行为验收截图
├── packages/identity/   身份包 @probe/identity（源码 + 测试）
│   ├── src/model.ts               Person、公开投影、personOf
│   ├── src/index.ts               浏览器安全入口（不含 node:fs）
│   ├── src/server/people-file.ts  StoredPerson、parsePeople、readPeopleFile
│   ├── src/server/identity.ts     resolveIdentity、identityCodeEnvName
│   ├── src/server/write-access.ts WriteAccessError、authorizeWrite、writeAccessResponse
│   ├── src/react/index.tsx        Avatar、IdentityBadge（children 是宿主插槽）
│   ├── styles.css                 组件样式（类名前缀 ib-）
│   └── test/                      Vitest（26 个）
└── sample/              最小组合样本 @probe/sample
    ├── people.json      虚构身份码的人员列表（盘协议不变）
    ├── comments.ts      评论业务纯函数桩（不 import 身份包）
    ├── routes.ts        宿主接线：React Router 资源路由形状的 loader/action
    ├── page.tsx         SSR 页面与错误页（用 identity/react 组件）
    ├── http-server.ts   Node http 驱动 + CLI（--port/--identity-code）
    ├── extra.css        页面补充样式
    └── test/            Vitest（12 个：组合边界 + HTTP 全链路）
```

## 常用命令（都在本目录跑）

| 命令 | 做什么 |
| --- | --- |
| `pnpm build` | 构建身份包与样本（tsc，产物在各自 dist/） |
| `pnpm check` | 两包类型检查 + 全部 Vitest（38 个） |
| `pnpm sample:writable` | 起可写样本：http://127.0.0.1:5490（身份码 probezhou001） |
| `pnpm sample:readonly` | 起只读样本：http://127.0.0.1:5491（无身份码） |

两个样本页都内置演示：人员公开列表、当前身份徽章（含宿主插槽）、评论表单（藏了一个自报 `actor` 字段，服务端忽略它）、以 agent 代发的 `as` 选择。只读实例提交表单会得到 403 错误页。

## 身份包的公开导出

| 入口 | 导出 |
| --- | --- |
| `@probe/identity` | `Person`、`SiteIdentity`（类型）；`peopleFile`、`personOf`、`publicPersonOf`、`publicPeopleOf` |
| `@probe/identity/server` | `StoredPerson`（类型）；`identityCodePattern`、`parsePeople`、`readPeopleFile`、`identityCodeEnvName`、`resolveIdentity`、`authorizeWrite`、`writeAccessResponse`、`WriteAccessError` |
| `@probe/identity/react` | `Avatar`、`IdentityBadge` |
| `@probe/identity/styles.css` | 组件样式 |

`authorizeWrite(request, { identity, people, as, origin })`：Origin 头与宿主配置逐字符相等才放行（永远不从 request.url 推导）；无身份 403；as 省略用当前身份，非字符串/空串/未登记 400，是人 403，是 agent 则以它署名。成功返回的人经白名单投影，codes 与任何服务端字段带不出去。

## 依赖（版本固定，不追新）

- 运行时：react 19.3.0（peer，仅 react 入口需要）
- 开发：typescript 6.0.3、vitest 5.0.3、@types/node 26.6.4、@types/react(Dom) 19.3.0
- 不依赖 fumadocs、react-router（资源路由按 Web 标准 Request/Response 写，React Router 下原样可用）
