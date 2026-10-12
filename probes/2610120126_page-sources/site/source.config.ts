import { defineConfig } from 'fumadocs-mdx/config';

/**
 * Config API 的配置入口：编译选项集中在这里（只由构建期的 Node 加载，浏览器不解析这个文件）。
 * 集合定义在 app/lib/source.ts 用宏（fumadocs-mdx/macro）——官方 React Router 示例的现行形态，
 * 集合的 frontmatter 与正文分离加载就是 server/browser 分离：标题等元数据两端同步可用，正文按需加载
 */
export default defineConfig({});
