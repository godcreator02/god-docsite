import { createFromSource, type SearchAPI } from 'fumadocs-core/search/server'
import type { LoaderConfig, LoaderOutput } from 'fumadocs-core/source'

/**
 * 中文站点的搜索服务：站点路由用它包装自己的 loader，代替直接调 fumadocs 的 createFromSource。
 * zbsearch 默认 multilingual 分词（中文能切开），但另两项默认值不适合中文：
 * tolerance 1 允许一个字的出入，搜「滑块」会命中「模块」；threshold 1 只要切出的词有一个出现就算命中，
 * 搜「页面树」时含「页面」的页全都返回。这里两项都设为 0：每个词都要原样出现。
 *
 * 传函数而不是 loader 实例：createFromSource 的公开约定是 loader 实例变化时重建全部索引，
 * 开发模式下内容增删让来源模块重新执行、得到新 loader 时，搜索跟着重建
 */
export function searchServerOf<C extends LoaderConfig>(getSource: () => LoaderOutput<C>): SearchAPI {
  return createFromSource(getSource, { search: { tolerance: 0, threshold: 0 } })
}
