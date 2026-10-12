/**
 * 文档站 UI 外壳（能力小包）：侧栏分组与搜索触发、站内链接卡片、全宽切换、主题切换与身份标识、
 * 中文界面文字、推送通道的浏览器 hook。组合点（摆位、接哪些）在骨架模板里
 */
export { groupKeepingSidebar, routeLinksSearchTrigger, SidebarRouteLinks, type SidebarRouteLink } from './sidebar.js'
export {
  commentLinkTargetsOf,
  linkChipClassName,
  linkChipIconClassName,
  siteLinkComponent,
  SiteLinksProvider,
  type CommentLinkTarget,
  type SiteLinkKind,
  type SiteLinksData,
} from './site-links.js'
export { PageTitleWithWideToggle, WidePageToggle, widePageScript } from './wide-page.js'
export { themeSwitchWithIdentity } from './theme-switch.js'
export { zhTranslations } from './translations.js'
