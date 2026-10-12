import type { Translations } from '@fumadocs/base-ui/i18n'

/**
 * fumadocs 界面文字的中文：交给项目骨架 root.tsx 里 RootProvider 的 i18n.translations。
 * 键是原文加括号里的用处说明，照 @fumadocs/base-ui 的 Translations 类型写，写错键名类型检查就报错
 */
export const zhTranslations: Partial<Record<keyof Translations, string>> = {
  'Search(search trigger)': '搜索',
  'Search(search dialog)': '搜索',
  'Open Search(search trigger)(aria-label)': '打开搜索',
  'Close Search(search dialog)(aria-label)': '关上搜索',
  'No results found(search dialog)': '没有找到',
  'On this page(table of contents)': '本页目录',
  'No Headings(table of contents)': '没有小标题',
  'Table of Contents(inline table of contents)': '本页目录',
  'Previous Page(pagination)': '上一页',
  'Next Page(pagination)': '下一页',
  'Last updated on(page footer)': '最后更新于',
  'Theme(site menu)': '主题',
  'Options(aria-label)': '更多',
  'Light(theme switcher)(aria-label)': '浅色',
  'Dark(theme switcher)(aria-label)': '深色',
  'System(theme switcher)(aria-label)': '跟随系统',
  'Toggle Theme(theme switcher)(aria-label)': '切换主题',
  'Collapse Sidebar(sidebar)(aria-label)': '收起侧栏',
  'Open Sidebar(sidebar)(aria-label)': '打开侧栏',
  'Close Sidebar(sidebar)(aria-label)': '关上侧栏',
  'Copy Anchor Link(heading anchor)(aria-label)': '复制这一节的链接',
  'Copied Anchor Link(heading anchor)(aria-label)': '已复制链接',
  'Copy Text(code block)(aria-label)': '复制',
  'Copied Text(code block)(aria-label)': '已复制',
  'Copy Link(accordion)(aria-label)': '复制链接',
  'Copied Link(accordion)(aria-label)': '已复制链接',
  'Close Banner(banner)(aria-label)': '关闭',
  'Prop(type table)': '参数',
  'Type(type table)': '类型',
  'Default(type table)': '默认值',
  'Parameters(type table)': '参数',
  'Returns(type table)': '返回',
  'Page Not Found(404 not found page)': '没有这一页',
  'Back to Home(404 not found page)': '回首页',
}
