import { defineConfig } from "tsdown";

// 入口与 package.json 的出口一一对应：site/index 进浏览器，只从 core 取东西；node/ 只经 index.server、构建期入口（vite、mdx）、建站器入口（node/scaffold，纯 Node）
// 与站点身份文件入口（node/identity）、引用扫描与外部 mdx 检查入口（node/index）出去；身份入口纯 Node、不靠自己模块的位置找文件，插件可以打包进去，
// node/index 带着 mdx 编译器、要站点装的功能包，插件不打包它，用到时从插件旁边装的平台包动态加载。
// 服务端入口的产物名以 .server.mjs 结尾，React Router 的 .server 检查才认得出它
export default defineConfig({
  entry: {
    "core/index": "src/core/index.ts",
    "vite/index": "src/vite/index.ts",
    "mdx/index": "src/mdx/index.ts",
    "site/index": "src/site/index.ts",
    "site/index.server": "src/site/index.server.ts",
    "site/tex": "src/site/tex-entry.ts",
    "node/scaffold": "src/node/scaffold/index.ts",
    "node/identity": "src/node/site-identity.ts",
    "node/index": "src/node/index.ts",
    "cli/serve": "src/cli/serve.ts",
    "cli/check": "src/cli/check.ts",
  },
  format: ["esm"],
  platform: "node",
  dts: true,
  clean: true,
});
