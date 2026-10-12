# 任务 I 交付记录：@godcreator/docsite-identity

日期：2026-10-11。写入范围：`packages/docsite-identity/`（新建）与 `probes/2610112023_docsite-kit-complete/package-split/identity/`（新建）。旧 `packages/docsite-kit` 只读未动，未触碰仓根 lock/workspace/共享配置、其他仓与其他目录。

## 实际变更（全部为新建文件）

包（`packages/docsite-identity/`）：

| 文件 | 内容 |
| --- | --- |
| `package.json` | 包名 `@godcreator/docsite-identity`，`private: true`，`version: 0.0.0`（首次发版前按 gwb-release 定号），exports 三入口 `.`、`./server`、`./react`，peer 依赖仅 `react ^19.3.0`，无运行时 dependencies（server 只用 Node 内置），scripts 同基础包（build/typecheck/test/check） |
| `tsconfig.json` / `tsconfig.build.json` | 与基础包同构；`types: ["node"]`（不引 vite/client，包里没有 `import.meta.env`） |
| `README.md` | 包说明：三入口、公开接口、身份码不出服务端的边界、检查命令与当前状态 |
| `src/model.ts` | 公开模型：`Person`（无 codes）、`SiteIdentity`、`peopleFile`、`personOf`、`publicPersonOf`、`publicPeopleOf`、`mentionsOf`、`mentionBeingTyped`、`peopleMatching`（后两个纯函数原样迁移） |
| `src/index.ts` | 根入口，重导出 model |
| `src/server/people-file.ts` | `StoredPerson`、`identityCodePattern`、`parsePeople`、`peopleWithJoined`（校验消息逐字保持） |
| `src/server/site-people.ts` | `sitePeople`（每次重读磁盘；`jsonFileOf` 改为模块内私有） |
| `src/server/identity.ts` | `identityCodeEnvName`、`identityOf`（返回投影后的人）、`siteIdentity`（只看环境变量） |
| `src/server/write-access.ts` | `WriteAccessError`、`authorizeWrite`（签名按共同契约） |
| `src/server/index.ts` | server 入口，重导出以上全部 |
| `src/react/index.tsx` | `Avatar`（逐字迁移）、`IdentityBadge`（新组件：旧 `themeSwitchWithIdentity` 的身份部分，不带主题切换，不用 fd-* 主题类） |
| `test/model.test.ts`、`test/people-file.test.ts`、`test/identity.test.ts`、`test/write-access.test.ts` | vitest 回归测试：沿用旧 people.test / comment-requests.test 里归身份的用例，新增码不泄露与 Origin/as 拒绝路径 |

实验材料（`probes/2610112023_docsite-kit-complete/package-split/identity/`）：`selfcheck.ts`（node 24 类型剥离直接执行 src 的自检，44 项）、`ts-extension-hooks.mjs`（把 `.js` 后缀 import 映射回 `.ts` 源的运行钩子，仅自检用）、`run-checks.ps1`、`checks.log`（三项检查的完整输出）。

## 公开 exports

`.`：`Person`、`SiteIdentity`（类型）；`peopleFile`、`personOf`、`publicPersonOf`、`publicPeopleOf`、`mentionsOf`、`mentionBeingTyped`、`peopleMatching`。
`./server`：以上全部，再加 `StoredPerson`（类型）、`identityCodePattern`、`parsePeople`、`peopleWithJoined`、`sitePeople`、`identityCodeEnvName`、`identityOf`、`siteIdentity`、`authorizeWrite`、`WriteAccessError`。
`./react`：`Avatar`、`IdentityBadge`。

签名与共同契约一致（`personOf`/`peopleMatching` 为契约给的泛型形式；`authorizeWrite(request, { identity, people, as?, origin })` 未改名）。

## 实跑命令及退出码（完整输出在 checks.log）

| 命令 | 退出码 | 结果 |
| --- | --- | --- |
| `node --import ./ts-extension-hooks.mjs selfcheck.ts`（本目录） | 0 | 44 项全部 PASS：model、parsePeople 校验消息逐字符核对、peopleWithJoined、identityOf/siteIdentity（含磁盘与环境变量）、authorizeWrite 全部拒绝/放行路径 |
| `tsc -p tsconfig.json --noEmit`（调用 packages/docsite-kit 已装的 tsc） | 2 | 仅 `TS2688: Cannot find type definition file for 'node'`——@types/node 未装（本包未 install，契约留给集成会话）。此错使完整类型检查无法完成，不能当作类型已验证 |
| `vitest run`（用 packages/docsite-kit 已装的 vitest v5.0.3 跑，cwd 在本包） | 0 | 4 个测试文件 20 个测试全部通过（vite 把 `.js` 后缀 import 解析到 `.ts` 源；测试不 import react）。跑完删掉了它生成的 `node_modules/.vite` 缓存 |

依赖未安装（未在父 workspace 执行 install、未改 lock、未做 node_modules junction）；tsc/vitest 调用的是同仓 packages/docsite-kit 里已存在的工具，未写任何安装状态。

## 待集成检查（留给 K）

1. 本包安装依赖后跑 `pnpm typecheck`（当前 TS2688 挡住，react 入口的类型检查从未执行过）与 `pnpm test`（用本包自己的 vitest）。
2. `pnpm build`（`tsc -p tsconfig.build.json` 产出 dist 与声明文件；react 入口 `jsx: react-jsx` 的 emit 未验证过）。
3. exports 三入口的运行时解析（node ESM 按入口导入）。
4. `Avatar`/`IdentityBadge` 在浏览器里的渲染验证。
5. 与 J 评论包集成：`commentRequestResponse` 的 `siteOrigin` + `authorizeWrite` 集成、Origin 从宿主可信配置传入。

## 已知差异与风险（相对旧 docsite-kit 行为）

1. **只读原因不再包含码**：旧 `identityOf` 的 reason 写「本机的身份码 `<码>` 不在 people.json 里」；按契约「公开结果和只读原因不得泄露码」，新 reason 去掉码本身。旧测试对应断言已随之改写。
2. **siteIdentity 不再看 `import.meta.env.DEV`**：旧版发布构建一律只读；新版只看环境变量有没有码（独立包经 tsc 编译，`import.meta.env` 是 Vite 编译期特性，不可用）。发布站由宿主保证不设 `DOCSITE_IDENTITY_CODE`；若宿主在发布环境设了码，新包会给身份——与旧版不同，接线时注意。
3. **`siteCommenter` 未迁入**：它是评论概念（`Commenter`），契约接口清单没有它；等价写法 `siteIdentity(siteDir).person`。
4. **旧 `actorOf`（从表单读 as）被 `authorizeWrite` 取代**：as 改由调用方（评论包）从表单读出后传入 options；校验语义保持（未知 400、非 agent 403），新增 Origin 精确匹配 403 与无身份 403。无身份的 403 文案从固定句「这个站只读：评论在本机的开发服务里写」变为 identity.reason（更具体的只读原因）。
5. **IdentityBadge 与旧 `themeSwitchWithIdentity` 的差异**：不含 ThemeSwitch（主题切换归站点）；身份一栏的配色从 fd-* 主题类改为标准 Tailwind 类与透明度（不依赖 fumadocs 的 Tailwind 插件，宿主没配也能用；视觉上中性一些）。K 集成时站点自行把主题切换放在旁边。
6. **类型检查未完成**（见上）：不能声称类型已验证。
7. 版本号 `0.0.0` 是占位：首次发版前按 gwb-release 与实际首次包情况定号。

## 进程

无遗留进程：没有启动任何服务；node、tsc、vitest 都是一次性进程且已退出；自检用的临时目录在脚本里清理；vitest 缓存已删。

---

# 修正记录（2026-10-11 第二轮）：authorizeWrite 的白名单投影

主会话审阅发现契约缺口并实证（`review/20261011-2151-authorize-projection.mjs` 与同名 txt，退出 1）：`authorizeWrite` 的两条成功路径原来直接 `return identity.person` / `return person`——`Person` 是结构化类型，调用方传入的对象带着 `codes` 或别的服务端字段时会原样带出，与 handoff「返回均经 publicPersonOf 投影」的声称不符。首次交付的记录（上文）保留不动，`checks.log` 保留不动。

## 修正内容

- `src/server/write-access.ts`：两条成功路径改为 `return publicPersonOf(identity.person)` 与 `return publicPersonOf(person)`，doc 注释写明原因；签名、Origin/无身份/as 拒绝语义均未动。
- `test/write-access.test.ts` 新增 describe「返回的人经白名单投影」两个用例：输入直接构造携带 `codes` 与 `extra` 的对象（`StoredPerson & { extra: string }`、`Person & { extra: string }`），不经 `identityOf` 预投影；断言 as 省略/null 与 as 为合法 agent 两种情况下返回值只含 id/name/gitea?/agent?，且输入对象未被修改。测试从 20 个增至 22 个。
- `selfcheck.ts` 同步：删掉原来用 `identityOf` 产物做的弱断言（恰是这次暴露的问题模式），换成同样的直接输入覆盖，新增 5 项（44 → 48 项）。

## 实跑命令及退出码（完整输出在 checks-fix.log；run-checks-fix.ps1）

| 命令 | 退出码 | 结果 |
| --- | --- | --- |
| `node --import file:///…/ts-extension-hooks.mjs 20261011-2151-authorize-projection.mjs`（主会话的复现脚本，只读未改；直接 `node` 跑会在 `../model.js` 上报扩展名解析错误，带钩子跑才是可执行跑法） | 0 | 两条 `projected: true`，与首次 txt 的两条 `projected: false` 对应 |
| `node --import ./ts-extension-hooks.mjs selfcheck.ts` | 0 | 48 项全部通过（含新增 5 项投影断言） |
| `vitest run`（本包 `node_modules/.bin/vitest`） | 0 | 4 个测试文件 22 个测试全部通过 |
| `tsc -p tsconfig.json --noEmit`（本包 `node_modules/.bin/tsc`） | 0 | 完整类型检查通过——react 入口（`Avatar`/`IdentityBadge`，`jsx: react-jsx`）的类型首次真正验证 |

检查全部直接调用已有可执行文件，未用 pnpm exec，未执行任何安装。

## 依赖状态说明

本包 `node_modules`（`@types`、`react`、`typescript`、`vitest`、`.bin`）是上一轮 J 会话因 `pnpm exec` 触发安装留下的实际状态（lock 已由 J 恢复，实体还在，主会话已确认根配置干净）。本会话没有执行过安装，只是复用了这个已存在的状态，因此本轮 tsc 与 vitest 都能完整跑通；依赖的正式安装仍由集成会话（K）串行做。主会话复跑 vitest 留下的 `.vite` 缓存与本次运行的缓存均未删（属正常缓存）。

## 待集成检查（更新）

原清单里「安装依赖后 typecheck（react 入口类型从未检查过）」与「安装依赖后 test」两项：本轮借助已存在的 node_modules 已实际跑过且全绿，保留的待办是 K 正式安装后用包脚本 `pnpm check` 复跑确认，以及 `pnpm build`（dist 产物 emit 未验证）、exports 三入口运行时解析、Avatar/IdentityBadge 浏览器渲染、与 J 评论包集成（`siteOrigin` + `authorizeWrite`）。
