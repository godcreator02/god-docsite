import { loader } from 'fumadocs-core/source'
import { htmlPageSource, tsxPageSource } from '@probe/page-sources'
import { searchServerOf } from '@probe/page-sources/server'
import { docs } from './collections'

/**
 * 三种格式的页面进同一棵页面树、同一个搜索索引；page.type 是来源的名字（mdx / tsx / html）。
 * 只在服务端用（.server 文件不进浏览器包）：HTML 原文与 TSX meta 的 eager glob 都在这里，
 * 路由的 loader 从这里查页，浏览器端渲染走各格式自己的按需入口（宏集合、懒 glob、iframe）
 *
 * 两个 glob 都用根路径模式（以 / 开头、不带 base）：Vite 按项目根解析，
 * 避开 Windows 上相对 base 的 toAbsoluteGlob 缺陷（见 ../README.md 与 result.md）
 */
const tsxPageMeta = import.meta.glob('/content/**/*.page.tsx', { eager: true, import: 'meta' })
const htmlPageText = import.meta.glob('/content/**/*.html', { eager: true, query: '?raw', import: 'default' })

export const source = loader({
  source: { mdx: docs.toFumadocsSource(), tsx: tsxPageSource(tsxPageMeta), html: htmlPageSource(htmlPageText) },
  baseUrl: '/',
})

/** 搜索服务：loader 实例变化（开发时内容增删让本模块重新执行）时按公开约定重建索引 */
export const searchServer = searchServerOf(() => source)
