import { defineConfig } from 'vitest/config'
import { fumadocsMdx } from 'fumadocs-mdx/vite'

/**
 * 只挂 fumadocs-mdx 的 Vite 插件：测试 import 的是 .source/server（生成入口），
 * 它的 import.meta.glob 带 ?collection=… 虚拟查询，要这个插件编译。
 * 不挂 reactRouter——那是站点构建的事
 */
export default defineConfig({
  plugins: [fumadocsMdx()],
})
