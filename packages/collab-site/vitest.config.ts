import { defineConfig } from 'vitest/config'

// 文档站基础包的服务端代码读 import.meta.env.DEV，要经 Vite 编译；站点里由基础包的 Vite 插件设成 noExternal，测试里照做
export default defineConfig({
  test: { server: { deps: { inline: ['@godcreator/docsite-kit'] } } },
})
