import type { Plugin } from 'vite'

/**
 * dev 下关掉 Vite 自带的全屏报错层：热更新失败时页面还停在上一版、能用，改由平台布局里的问题按钮列出来（site/dev-updates）。
 * 页面整个渲染不出来时开发服务回的 500 报错页不受这个开关影响，照旧是整页
 */
export function devIssuesInsteadOfViteOverlay(): Plugin {
  return {
    name: 'god-docsite:dev-issues-instead-of-vite-overlay',
    apply: 'serve',
    config: () => ({ server: { hmr: { overlay: false } } }),
  }
}
