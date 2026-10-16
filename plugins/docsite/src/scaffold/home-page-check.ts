import { DocsiteRejected } from '../errors.js'
import type { SiteStarted } from '../site-host.js'

/** 起服务检查要的：启停站点、首页探活、站点是否登记为常驻。测试里换成假的 */
export type HomePageCheckDeps = {
  isRegistered(dir: string): Promise<boolean>
  start(dir: string): Promise<SiteStarted>
  stop(dir: string): Promise<{ url: string }>
  /** 回首页的 HTTP 状态码。进程活着不等于站能用：缺依赖、功能模板有错时开发服务起得来、页面 500 */
  pageStatus(url: string): Promise<number>
}

/**
 * 起开发服务、看首页回不回 200；通过后登记为常驻的站保持运行，没登记的停掉。
 * 没通过就报错、站点保持运行，报错写明在浏览器里看开发服务的报错
 */
export async function checkHomePage(dir: string, after: string, deps: HomePageCheckDeps): Promise<void> {
  const started = await deps.start(dir)
  const status = await deps.pageStatus(started.url)
  if (status !== 200) {
    throw new DocsiteRejected(`${after}，起服务检查没过：首页（${started.url}）返回 ${status}。站点还开着，开发服务的报错在浏览器里看；用 docsite.site.stop 停掉`)
  }
  if (!(await deps.isRegistered(dir))) await deps.stop(dir)
}
