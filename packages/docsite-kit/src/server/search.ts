import { createFromSource } from 'fumadocs-core/search/server'
import type { LoaderConfig, LoaderOutput } from 'fumadocs-core/source'

/**
 * 中文站点的搜索接口：项目的 app/routes/search.ts 用它代替 fumadocs 的 createFromSource(source)。
 * fumadocs 默认按 Unicode 规则切词（中文能切开），但另有两项默认值不适合中文：
 * tolerance 1 允许一个字的出入，搜「滑块」会命中「模块」；threshold 1 只要切出的词有一个出现就算命中，
 * 搜「页面树」时含「页面」的页全都返回。这里两项都设为 0：每个词都要原样出现
 */
export function siteSearchServer<C extends LoaderConfig>(source: LoaderOutput<C>) {
  return createFromSource(source, { search: { tolerance: 0, threshold: 0 } })
}
