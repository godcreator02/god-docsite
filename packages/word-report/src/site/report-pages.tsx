/**
 * 报告列表页与报告页：都在整站布局里，数据用 useLoaderData 从 ./site/server 的 loader 取。
 */
import { Link, useLoaderData } from 'react-router';
import { DocsBody, DocsPage, DocsTitle } from '@fumadocs/base-ui/layouts/docs/page';
import type { ReportListData, ReportPageData, ReportSummary } from './page-data.ts';
import { reportAssetHrefOf, reportHrefOf } from './page-data.ts';
import { ReportView } from './report-view.tsx';

function checkTextOf(report: ReportSummary): string {
  if (report.problem !== null) return report.problem;
  return report.warningCount > 0 ? `${report.warningCount} 条提示` : '没有问题';
}

export function ReportListPage() {
  const { reports, siteName, hrefBase } = useLoaderData<ReportListData>();
  return (
    <DocsPage>
      <title>{`报告 · ${siteName}`}</title>
      <DocsTitle>报告</DocsTitle>
      <DocsBody>
        {reports.length === 0 ? (
          <p className="report-list-empty">这个站点还没有报告。报告放在站点根下的 reports/&lt;报告 id&gt;/content.json。</p>
        ) : (
          <div className="report-list-wrap">
            <table className="report-list" data-report-list="">
              <thead>
                <tr>
                  <th>报告</th>
                  <th>版本</th>
                  <th>日期</th>
                  <th>作者</th>
                  <th>章</th>
                  <th>检查</th>
                </tr>
              </thead>
              <tbody>
                {reports.map((report) => (
                  <tr key={report.id} data-report-row={report.id}>
                    <td>
                      <Link to={reportHrefOf(hrefBase, report.id)}>{report.title}</Link>
                    </td>
                    <td>{report.revision ?? ''}</td>
                    <td>{report.date ?? ''}</td>
                    <td>{report.authors.join('、')}</td>
                    <td>{report.chapterCount > 0 ? report.chapterCount : ''}</td>
                    <td className={report.problem !== null ? 'report-list-problem' : undefined}>{checkTextOf(report)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </DocsBody>
    </DocsPage>
  );
}

export function ReportDocumentPage() {
  const { report, toc, reportId, siteName, hrefBase } = useLoaderData<ReportPageData>();
  const { metadata } = report.document;
  const metaLine = [metadata.revision, metadata.date, metadata.authors?.join('、')].filter((part) => part !== undefined && part !== '');
  return (
    <DocsPage toc={toc}>
      <title>{`${metadata.title} · ${siteName}`}</title>
      <DocsTitle>{metadata.title}</DocsTitle>
      {metaLine.length > 0 ? <p className="report-meta-line">{metaLine.join(' · ')}</p> : null}
      <Link className="report-back" to={hrefBase}>
        ← 全部报告
      </Link>
      <DocsBody>
        <ReportView report={report} assetUrl={(_source, compiledPath) => reportAssetHrefOf(hrefBase, reportId, compiledPath)} />
      </DocsBody>
    </DocsPage>
  );
}
