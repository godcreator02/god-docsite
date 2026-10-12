# @godcreator/docsite-identity

文档站的人员与身份：people.json 的读取与校验、本机身份码找人、写入请求的身份与来源核对、头像与身份标识组件。
从基础包 `@godcreator/docsite-kit` 的 people.ts、server/site-people.ts、server/comments.ts 里的身份逻辑与 ui/comment-cards.tsx 的头像拆出；拆包期间旧包不动，两边并存到站点集成完成为止。

## 三个入口

| 入口 | 给谁用 | 内容 |
| --- | --- | --- |
| `@godcreator/docsite-identity` | 浏览器与服务端都能用 | 人员与身份的公开模型，不含身份码 |
| `@godcreator/docsite-identity/server` | 只给 Node（站点服务器） | people.json 校验与读取、身份码、写入核对 |
| `@godcreator/docsite-identity/react` | 给浏览器（React） | Avatar、IdentityBadge |
| `@godcreator/docsite-identity/styles.css` | 站点的 app.css 引入 | `.dc-avatar`、`.dc-identity` 的样式，不依赖宿主的 Tailwind 或主题 |

根入口无 Node 与 React 的导入；`/react` 只依赖 `react`（peer 依赖 `^19.3.0`）；`/server` 只用 Node 内置模块。

## 公开模型（根入口）

```ts
type Person = { id: string; name: string; gitea?: string; agent?: boolean }  // 无 codes：身份码只留在服务端
type SiteIdentity = { person: Person; reason?: undefined } | { person: null; reason: string }

const peopleFile = 'people.json'                     // 人员列表的文件名，站点目录里
function personOf<T extends Person>(people: readonly T[], id: string): T
function publicPersonOf(person: Person): Person      // 白名单投影：id、name、gitea、agent，codes 进不来
function publicPeopleOf(people: readonly Person[]): Person[]
function mentionsOf(body: string, people: readonly Person[]): string[]            // 正文里 @ 了谁
function mentionBeingTyped(textBeforeCursor: string): { start: number; query: string } | null
function peopleMatching<T extends Person>(people: readonly T[], query: string): T[]  // @ 名单的筛选
```

给浏览器的人员列表先用 `publicPeopleOf` 投影一遍再传下去；`SiteIdentity`（由 `/server` 算出）本身不含码，可以直接传。

## 服务端（/server）

```ts
type StoredPerson = Person & { codes?: string[] }    // people.json 里的存放形状
const identityCodePattern: RegExp                    // 身份码：8 到 64 个小写字母或数字
const identityCodeEnvName = 'DOCSITE_IDENTITY_CODE'  // 开发服务从这个环境变量取本机的身份码

function parsePeople(value: unknown): StoredPerson[] // 校验 people.json：id、码都不重复，写错时一次列出全部
function sitePeople(siteDir?: string): StoredPerson[]      // 站点目录里的 people.json，每次重新读
function peopleWithJoined(people: readonly StoredPerson[], code: string, joining: { id: string; name: string; gitea?: string }): StoredPerson[]
function identityOf(people: readonly StoredPerson[], code: string | undefined): SiteIdentity
function siteIdentity(siteDir?: string): SiteIdentity      // 按环境变量的身份码在人员列表里找人
function authorizeWrite(request: Request, options: { identity: SiteIdentity; people: readonly Person[]; as?: string | null; origin: string }): Person

class WriteAccessError extends Error { readonly status: number }  // 写入被拒：status 是要回给浏览器的 HTTP 状态码
```

几条边界：

- **身份码不出服务端**：`identityOf`、`siteIdentity`、`authorizeWrite` 返回的人都是投影过的（无 codes），只读的 reason 里也不写码本身。
- **身份只由配置码决定**：`siteIdentity` 只看环境变量里有没有码，不看 DEV 编译标记。发布出去的站由宿主保证不设 `DOCSITE_IDENTITY_CODE`。
- **authorizeWrite 的核对顺序**：请求的 `Origin` 头要和宿主可信配置传入的 `origin` 完全一样（缺失、不匹配 403）→ 没有本机身份 403 → `as` 省略（undefined 或 null）用当前身份，给了就只能是人员列表里已登记的 agent（没有这个人 400，是人的 403）。身份与 origin 都不由请求传入。

## 浏览器（/react）

- `Avatar({ person, size? })`：名字的第一个字加一个由 id 算出的底色，不联网取图。
- `IdentityBadge({ identity })`：侧栏底部显示的当前身份；只读时写「只读」，鼠标停上去看原因。主题切换是站点的事，宿主把它放在旁边。
- 两个组件的样式全在包自己的 `styles.css`（`.dc-avatar`、`.dc-identity`）里，宿主引入这一份就有；不依赖 Tailwind、fumadocs 或别的主题。

## 检查

```
pnpm typecheck   # tsc --noEmit
pnpm test        # vitest run
pnpm check       # 上面两样
pnpm build       # 产出 dist
```

当前状态：包还是 private（版本 0.0.0，首次发版前定号）；依赖已在仓根 workspace 安装。
model 与 server 的行为由 `probes/2610112023_docsite-kit-complete/package-split/identity/` 下的自检脚本与 vitest 回归测试验证，react 入口的类型检查、构建与浏览器渲染在集成记录 `probes/2610112023_docsite-kit-complete/package-split/integration/` 里。
