import { defineConfig } from "tsdown";

export default defineConfig({
  /**
   * 文档站基础包的功能包要的几个出口，加上两条路由的模块（路由表里写的是它们在包里的路径）：
   *   content      构建页面时在 Node 里执行的 remark 插件
   *   routes       路由表，在 Node 里读，不引用 React 组件
   *   site         浏览器端也用的：侧栏入口与 MDX 组件
   *   site-server  只在服务端运行的布局数据（没有）
   *   routes/disk、routes/card  星轨盘与卡页的路由模块
   */
  entry: {
    content: "src/content.ts",
    routes: "src/routes.ts",
    site: "src/site.tsx",
    "site-server": "src/site-server.ts",
    "routes/disk": "src/routes/disk.tsx",
    "routes/card": "src/routes/card.tsx",
  },
  format: ["esm"],
  platform: "node",
  dts: true,
  clean: true,
  // 站点装的那份：React、路由、fumadocs、基础包与站点骨架里的模块（别名 @site），以及本仓的兄弟包都按包名留在产物里
  deps: { neverBundle: [/^react/, /^@fumadocs\//, /^fumadocs/, /^lucide-react/, /^@godcreator\//, /^@site\//] },
});
