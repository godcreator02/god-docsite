/** dev 下平台的 vite 插件经 Vite 的热更新连接发给浏览器的事件；发布版没有这条连接，也就没有这些事件 */

/** 功能包登记的数据目录（package.json 的 godDocsite.dataDirs）里有文件增删改：浏览器重新取当前页的 loader 数据 */
export const dataDirsChangedEvent = 'god-docsite:data-dirs-changed'

/** 内容目录的放法检查结果变了，载荷是 ContentLayoutReport */
export const contentLayoutReportEvent = 'god-docsite:content-layout-report'

/** 浏览器连上以后要一次当前的放法检查结果：开发服务只回给发来请求的那个页面 */
export const contentLayoutReportRequestEvent = 'god-docsite:content-layout-report-request'

/** dev 运行中内容目录放法检查的结果：problems 每条写明哪个文件、该怎么放；checkError 是这次没查成的原因，查成了是 null */
export interface ContentLayoutReport {
  contentDir: string
  problems: string[]
  checkError: string | null
}
