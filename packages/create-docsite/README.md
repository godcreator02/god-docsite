# create-docsite（建站核心，未打包登记）

docsite 站点的一次性建站文件生成核心：把一份模板文件树写进指定目录，建出站点骨架。
当前只交付核心与命令行，还没有 `package.json`（见「未完成的打包步骤」）。

## 当前怎么跑

CLI 与核心用 Node 24 直接运行（内置类型剥离跑 `.ts`，不需要编译步骤）；测试用 Vitest：

```sh
# 命令行：--dir 是要建的站点目录（可以不存在），--template 是模板目录（一棵普通文件树）
node src/cli.ts --dir <站点目录> --template <模板目录>

# 测试（真实临时目录 IO，临时目录在 probes/2610112023_docsite-kit-complete/package-split/create-core/tmp 下）
# vitest 借用 packages/docsite-kit 里已安装的那份，本包暂无 package.json、不执行 pnpm
../docsite-kit/node_modules/.bin/vitest.ps1 run

# 类型检查（借用 packages/docsite-kit 的 tsc 与 @types/node，不改那个包）
../docsite-kit/node_modules/.bin/tsc -p tsconfig.json
```

CLI 退出码：`0` 成功；`1` 建站被拒绝或写入失败；`2` 参数用法错误。成功打印新建与保留计数，
失败把原因（冲突时逐条列全）打到 stderr。

## 模板约定

模板是**一棵普通文件树**（没有骨架/数据的子目录协议），建站只复制文件、不执行其中任何脚本。
文件按**目标路径**分两类处理：

| 目标路径 | 已存在时 | 不存在时 |
| --- | --- | --- |
| `content/`、`comments/` 下的文件，顶层 `people.json`（数据材料，规则见 `src/plan.ts` 的 `dataMaterialPathRules`） | 保留目标里的，模板默认值不写入 | 写入模板的默认值 |
| 其余文件（骨架） | 判冲突，预检列出后整体拒绝，一个字节不写 | 写入 |

- 模板**顶层**名为 `gitignore` 的文件写进目标时改名为 `.gitignore`（npm 打包默认不把
  `.gitignore` 放进发布的包，模板里用不带点的名字带着它）。
- 建站成功后在站点根写创建标记 `.create-docsite.json`（`{"tool":"create-docsite","createdAt":...}`）。

## 行为

`createSite({ dir, templateDir })`（`src/create.ts`）返回
`{ createdFiles: string[]; keptFiles: string[] }`（相对站点根、正斜杠；`createdFiles` 含创建标记）。

- **一次性新建，不覆盖已有站点**：目标里存在 `package.json`、`app/` 或 `.create-docsite.json`
  任何一个就拒绝（错误码 `existing-site`）。
- **用户材料保留**：目标里已有的 `content/`、`comments/`、`people.json` 等条目一律不动；
  模板里的同名默认数据跳过（进 `keptFiles`），缺的补上。
- **冲突预检**：骨架文件的目标路径已存在、或路径上的中间目录已被同名文件 / 符号链接 /
  Windows junction 占住 → 一次性列出全部冲突后拒绝（错误码 `conflict`），不写任何文件。
- **路径限定**：模板与目标互不重叠（一方在另一方里面或相同即拒绝，`overlap`）；模板里的
  符号链接与 junction 一律拒绝（`template-error`）；目标路径上已存在的符号链接 / junction 段
  判为冲突，不越界写入。
- **只新建不覆盖**：文件用 `openSync('wx')` 独占创建，open 成功才登记为本次所有（之后写内容
  中途失败也由回滚撤走）；open 阶段的任何错误（EEXIST 等）发生在登记之前，不会覆盖、不会删。
- **失败回滚**：写入失败时只撤回本次新建的文件（含写了一半的）与本次新建的目录段——目标根
  不存在时根也算本次新建；预存在目录绝不删，删前确认在站点根内、目录只删空的；删不掉的记进
  错误消息里的残留清单。

错误类型 `CreateSiteError`（`code` 为 `invalid-argument` / `invalid-path` / `overlap` /
`template-error` / `existing-site` / `conflict` / `io-error` 之一，`conflict` 时 `details`
逐条列出冲突）。

## 回滚的边界

回滚保证的是**单进程、常规文件系统错误**下的撤回（如写入中途磁盘错误、权限错误）。
没有对并发进程同时写同一目标、断电恢复做过实现或测试，不承诺这些场景下的原子性；
`wx` 写入保证在任何时刻都不会覆盖已存在的文件。

## 模块

| 文件 | 职责 |
| --- | --- |
| `src/plan.ts` | 路径安全（真实路径解析、重叠判定、Windows 文件名预检、符号链接与 junction 识别）与模板扫描（单树 → 骨架 / 数据材料两组） |
| `src/create.ts` | `createSite`：已有站点判定、冲突预检、`wx` 写入、失败回滚 |
| `src/cli.ts` | `--dir` / `--template` 参数解析与退出码 |
| `test/*.test.ts` | Vitest 测试（describe / it / expect，真实临时目录 IO） |

## 未完成的打包步骤（等串行登记）

本目录当前**没有 `package.json`**，是刻意为之：包名、`bin`（`create-docsite` 命令）、
`exports` 入口与依赖声明（含把 `vitest` 定为 devDependency）要等本批其他会话交回、
workspace 安排稳定后串行登记（版本策略按 gwb-release），避免 workspace 安装扫到写到一半的包。
届时还要做：

- 最终站点模板的组装（真实的 fumadocs 骨架内容等 K 的站点结构稳定后再接）；
- `tsconfig.json` 现在借用 `../docsite-kit/node_modules`（`typeRoots` 指向其 `@types`、
  `paths` 把 `vitest` 映射到其 `dist/index.d.ts`），装好自己的依赖后改回默认解析；
- 接进 gwb-docsite 插件的建站命令。
