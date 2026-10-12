# 结果：身份边界探针（任务 P）

2026-10-12。独占目录 `docsite-kit/probes/2610120119_identity-boundary/`，未动其他 probe、packages、父 workspace/lock、正式 site 与其他仓。

## 交付了什么

1. **身份包 `@probe/identity`**（`packages/identity/`）：人员公开形状与白名单投影、people.json 盘协议校验与读取、宿主提供的身份码解析、写入请求的 Origin/as 判定、Avatar/IdentityBadge 组件（Badge 带 children 宿主插槽）。三个入口（`.` 浏览器安全、`./server`、`./react`）+ `./styles.css`。
2. **最小组合样本 `@probe/sample`**（`sample/`）：React Router 资源路由形状的宿主接线（loader/action，签名 `(args: { request }) => Promise<Response>`，React Router v7 route 模块下函数体原样可用），评论业务纯函数桩（不 import 身份包，作者只收 `{ id, name }`），SSR 页面，Node http 驱动 + CLI。`pnpm sample:writable`（5490，可写）与 `pnpm sample:readonly`（5491，只读）各起一个实例。

## 与 K 基线的关系

只读审查了 `packages/docsite-identity`（22 个已验测试），未改原包。按新契约重写收敛，不是搬迁：

- 复用的纯函数判定（逻辑已验，机械重造无意义）：`parsePeople` 的盘协议校验矩阵、`publicPersonOf` 白名单投影、按码找人判定、`authorizeWrite` 的 Origin/as 规则、Avatar 的 id 色相算法。people.json 盘协议（形状、码规则）原样保留。
- 重写的边界：删掉自读 `process.cwd()` 的 `sitePeople` 与自读环境变量的 `siteIdentity`，拆成 `readPeopleFile(siteDir)` + 纯函数 `resolveIdentity(people, code)`，码与 origin 由宿主显式传入；`as` 参数类型放宽为 `unknown`（宿主把表单值直接传入，包负责判定非字符串/空串 400）；新增 `writeAccessResponse` 辅助（非 WriteAccessError 原样再抛，不吞服务端错误）；IdentityBadge 增加 children 插槽；类名前缀从 `dc-` 改 `ib-`。
- 收窄掉的不在范围：`peopleWithJoined`（gwb-docsite 插件 join 命令域）、`mentionsOf`/`mentionBeingTyped`/`peopleMatching`（评论线的提及功能，归 N/O 线）。

## 边界规则（全部有测试钉住）

- 输入（people、身份码、可信 origin）由宿主明确提供；身份与 origin 不从请求取，`authorizeWrite` 永远不读 `request.url` 推导 origin（有 Host 伪造测试）。
- 公开投影：出服务端的人只有 `id/name/gitea?/agent?`；输入对象带 codes 或多余字段时带不出去（结构化类型防泄露测试）；所有拒绝路径的消息与页面不出现存储的身份码（矩阵遍历断言）。
- 无身份只读（403 + 原因）；合法身份写入；Origin 头与宿主配置逐字符相等才放行（缺失/不同/大小写不同/子域伪装都 403）。
- as：省略/`null` 用当前身份；空字符串、非字符串（数字、对象、File）、未登记的人 400；是人 403；是已登记 agent 则以它署名。
- 普通作者身份由服务端解析：表单自报 `actor` 字段被忽略（组合测试 + 浏览器实测均按身份码署名）。
- 判定不依赖 DEV/NODE_ENV（三种环境标记组合下同一矩阵结论一致）。

## 检查证据

- `pnpm build`：两包 tsc 构建通过（identity dist + sample dist）。
- `pnpm check`：两包类型检查通过；Vitest 共 **38 个测试全绿**（identity 26：投影 3、盘协议 6、身份解析 3、写入矩阵 10、组件 4；sample 12：组合边界 7、HTTP 全链路 5）。完整输出在 `check.log`。
- HTTP 全链路测试（随机端口，两个实例：有码/无码）：GET 页面渲染名字无码、合法提交 303 后可见、Origin 缺失/evil 403 且写入不发生、自报 actor 无效、只读实例一律 403、样式文件 200。
- 真实浏览器行为验收（IAB，5490/5491）：
  - 5490 以本人提交（真实点击「发表」）→ 303 跳回，评论署名小周，自报 `actor=li` 未生效；
  - 5490 选「代发为 Claude」提交（坐标点击）→ 署名 Claude（agent），表单重置；
  - 5491 只读实例填表提交（原生表单提交）→ 403 错误页显示只读原因与返回链接，无码泄露。
  - 截图在 `verification/`，视觉验收派 flashworker：可写首页四项全部通过；错误页首轮「样式未生效」经查是截图通道的竞态帧（computed style 与 styleSheets 规则数证明样式实际生效），另截同模板 GET 渲染的只读首页终审，样式与无码泄露两项全部通过，终审结论：页面本身无问题。

## 已知限制与未完成

- IAB 环境的按钮点击不稳（role/CSS locator 点击超时、坐标点击间歇落空），验收里两种真实点击路径各成功过，其余用浏览器原生 `form.requestSubmit()` 补齐——表单提交链路（POST + Origin + 导航）仍是浏览器原生行为。这是验收工具问题，不是样本问题。
- 评论桩是内存态（重启清空），故意不写盘：样本只演示身份边界，持久化归评论线。
- 样本页的 as 下拉只列 agent（页面层就不允许选人）；「冒充人 403」在包层与组合层测试覆盖，浏览器 UI 不提供这个入口。
- 未做：无 `jsdom` 的组件交互测试（用 renderToStaticMarkup 断言输出，交互行为由真实浏览器验收覆盖）。

## 复跑

见 `README.md` 第一行。浏览器验收：起两个样本后开 `http://127.0.0.1:5490/`（可写）与 `http://127.0.0.1:5491/`（只读）。
