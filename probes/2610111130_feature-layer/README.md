# 功能包叠加在基础骨架上：路由能不能由功能包交出、路由模块能不能放在包里、集合能不能另起一个文件

## 问什么

基础包要出站点模板，功能包（如协作站）只往上添加、不改基础骨架的文件。这取决于几件事：

1. 站点的 `app/routes.ts` 能不能 import 功能包导出的路由列表、展开进路由表
2. 路由模块能不能直接放在功能包里（装在 `node_modules`），不复制进项目
3. 放在包里的路由模块能不能经别名读站点项目里的模块（页面树 `source`）
4. 集合定义（`defineCollections`）能不能写在骨架的 `collections.ts` 以外的第二个项目文件里

开发服务、发布（`build` 后 `react-router-serve`）、浏览器里客户端跳转三种情况都要成立。

## 怎么运行

```text
node probes/2610111130_feature-layer/copy-skeleton.mjs site probes/2610111130_feature-layer/site
```

上面这一步已经做过、结果就是 `site/app/` 里与自述站一样的那些文件；试验改动是 `site/app/routes.ts`、`site/app/lib/probe-journal.ts`、
`site/app/routes/probe-journal.tsx`、`site/vite.config.ts`（别名 `@site` 与 `featurePackages`），假功能包在 `feature/`。
在 `site/` 里 `pnpm install`、`pnpm typecheck`，`pnpm dev`（端口 4439）或 `pnpm build` 后 `PORT=4438 pnpm start`，再运行：

```text
node probes/2610111130_feature-layer/probe-routes.mjs http://127.0.0.1:4439/
```

浏览器里客户端跳转：打开任意一页，控制台运行 `window.__reactRouterDataRouter.navigate('/probe/via-alias')` 等，看 `#probe-*` 元素的文字。

## 结论

四件事都成立，开发服务、发布、客户端跳转结果相同（`runs/04-routes-dev-and-publish.txt`）。条件有两个：

- 包里的路由模块，路由表要写**真实路径**。pnpm 的 `node_modules/<包>` 是符号链接，写链接路径时开发服务正常，
  但 `pnpm build` 报 `Chunk not found`（`runs/01-build-symlink-path.log`），而且 React Router 没把它认成路由模块，
  服务端代码留在浏览器端文件里（635 KB）。`routes.ts` 里先 `realpathSync` 再换成相对 `app/` 的路径，构建通过，那个文件 0.32 KB
- 集合定义只能在项目文件里：`fumadocs-mdx` 的 macro 写死跳过 `node_modules/**`（`fumadocs-mdx/dist/options-*.js` 的 `DefaultExclude`，
  不能配置），功能包里的 `defineCollections` 不会被处理。写在骨架以外的第二个项目文件里没问题

## 运行那次的环境

2026-10-11，Windows 11，Node v24.14.1，pnpm 12.4.2，React Router 8.4.0，Vite 8.3.4，fumadocs-mdx 15.4.4；
基础包是源上的 `@godcreator/docsite-kit@0.1.0`。
