/**
 * `@godcreator/word-report/site`：报告的显示组件（浏览器与服务端都用），列表页与报告页。
 */
export { ReportDocumentPage, ReportListPage, type ReportDocumentPageProps } from './report-pages.tsx'
export { ReportPage, ReportView, type AssetUrl, type ReportPageProps, type ReportViewProps } from './report-view.tsx'
export { reportMeta } from './report-meta.ts'
export { reportAssetHrefOf, reportHrefOf, type ReportListData, type ReportPageComments, type ReportPageData, type ReportSummary, type ReportTocItem } from './page-data.ts'
