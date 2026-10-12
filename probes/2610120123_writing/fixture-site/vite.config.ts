import { reactRouter } from '@react-router/dev/vite'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vite'
import { fumadocsMdx } from 'fumadocs-mdx/vite'

/** 官方示例的插件顺序：fumadocs-mdx 在前，内容宏在编译前替换好 */
export default defineConfig({
  plugins: [fumadocsMdx(), tailwindcss(), reactRouter()],
})
