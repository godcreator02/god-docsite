import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["test/**/*.test.{ts,tsx}"],
    // fumadocs 的组件 import 自己的 .css：经 Vite 处理，Node 直接加载会报认不出扩展名
    server: { deps: { inline: ["@fumadocs/base-ui"] } },
  },
});
