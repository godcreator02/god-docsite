import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["tests/*.test.mjs"],
    testTimeout: 60_000,
    // 站点的 MDX 组件表会带上 fumadocs 组件里 import 的样式：这些包交给 Vite 处理，Node 自己不认 .css
    server: { deps: { inline: [/@fumadocs\/base-ui/, /@godcreator\/god-docsite/] } },
  },
});
