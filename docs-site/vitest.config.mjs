import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["tests/*.test.mjs"],
    testTimeout: 60_000,
    // .mdx 交给 Node 原生 import，走 fumadocs-mdx/node 的 register() 注册的 loader，跟站构建时是同一条处理链
    server: { deps: { external: [/\.mdx/] } },
  },
});
