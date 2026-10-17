// 把 results/raw.jsonl 按「站 × 页数 × 缓存模式」分组，每组取中位数，写出 results/summary.json 与 results/summary.md。
// 用法：node summarize.mjs
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const resultsDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'results');
const siteLabels = { next: 'Next（默认，全部导入）', 'next-async': 'Next（按页懒加载）', 'next-lean': 'Next（省内存配置）', rr: 'Vite + React Router' };
const cacheModeLabels = { cold: '冷启动（先删缓存）', warm: '热启动（保留缓存）' };
// 主批次的记录没有 cacheMode 字段，都是冷启动；prime 只是给热启动生成缓存，不计入
const runs = readFileSync(join(resultsDir, 'raw.jsonl'), 'utf8')
  .trim()
  .split('\n')
  .map((line) => JSON.parse(line))
  // 早期版本的 bench.mjs 在超限时把超限说明也写进了 error，这里按超限处理
  .map((run) => ({ ...run, cacheMode: run.cacheMode ?? 'cold', error: run.overLimit ? null : run.error }))
  .filter((run) => run.cacheMode !== 'prime');

function median(values) {
  const present = values.filter((value) => typeof value === 'number').sort((a, b) => a - b);
  if (present.length === 0) return null;
  const middle = Math.floor(present.length / 2);
  return present.length % 2 === 1 ? present[middle] : (present[middle - 1] + present[middle]) / 2;
}

const groups = Map.groupBy(runs, (run) => `${run.site}|${run.pageCount}|${run.cacheMode}`);
const summary = [];
for (const [key, groupRuns] of groups) {
  const [site, pageCount, cacheMode] = key.split('|');
  const completed = groupRuns.filter((run) => run.error === null && run.overLimit === null);
  summary.push({
    site,
    pageCount: Number(pageCount),
    cacheMode,
    runs: groupRuns.length,
    completedRuns: completed.length,
    overLimitPhases: groupRuns.filter((run) => run.overLimit).map((run) => run.overLimit.phase),
    errors: groupRuns.filter((run) => run.error).map((run) => run.error),
    startupMs: median(groupRuns.map((run) => run.phases.startupMs)),
    firstPageMs: median(groupRuns.map((run) => run.phases.firstPageMs)),
    secondPageMs: median(groupRuns.map((run) => run.phases.secondPageMs)),
    crawlTotalMs: median(completed.map((run) => run.phases.crawl?.totalMs)),
    crawlMedianMs: median(completed.map((run) => run.phases.crawl?.medianMs)),
    crawlP95Ms: median(completed.map((run) => run.phases.crawl?.p95Ms)),
    hmrMs: median(completed.map((run) => run.phases.hmrMs)),
    peakWorkingSet: median(groupRuns.map((run) => run.memory.peak.workingSet)),
    peakPrivateBytes: median(groupRuns.map((run) => run.memory.peak.privateBytes)),
    afterStartupWorkingSet: median(groupRuns.map((run) => run.memory.afterStartup?.workingSet)),
    afterFirstPageWorkingSet: median(groupRuns.map((run) => run.memory.afterFirstPage?.workingSet)),
    afterCrawlWorkingSet: median(completed.map((run) => run.memory.afterCrawl?.workingSet)),
    idleEndWorkingSet: median(completed.map((run) => run.memory.idleEnd?.workingSet)),
    processCountAfterFirstPage: median(groupRuns.map((run) => run.processesAfterFirstPage?.length)),
    mainProcessWorkingSetAfterFirstPage: median(groupRuns.map((run) => run.processesAfterFirstPage?.[0]?.workingSet)),
  });
}
const cacheModeOrder = Object.keys(cacheModeLabels);
summary.sort(
  (a, b) =>
    a.pageCount - b.pageCount ||
    cacheModeOrder.indexOf(a.cacheMode) - cacheModeOrder.indexOf(b.cacheMode) ||
    Object.keys(siteLabels).indexOf(a.site) - Object.keys(siteLabels).indexOf(b.site),
);
writeFileSync(join(resultsDir, 'summary.json'), `${JSON.stringify(summary, null, 2)}\n`);

const megabytes = (bytes) => (bytes === null ? '—' : `${(bytes / 1024 ** 2).toFixed(0)}`);
const seconds = (ms) => (ms === null ? '—' : `${(ms / 1000).toFixed(2)}`);
const milliseconds = (ms) => (ms === null ? '—' : `${ms.toFixed(0)}`);
const status = (row) => {
  if (row.completedRuns === row.runs) return `${row.runs} 次全部完成`;
  const parts = [`完成 ${row.completedRuns}/${row.runs}`];
  if (row.overLimitPhases.length > 0) parts.push(`超限 ${row.overLimitPhases.length} 次（${[...new Set(row.overLimitPhases)].join('、')}）`);
  if (row.errors.length > 0) parts.push(`出错 ${row.errors.length} 次`);
  return parts.join('，');
};

const lines = ['# 汇总（每组 3 次取中位数）', ''];
for (const groupKey of [...new Set(summary.map((row) => `${row.pageCount}|${row.cacheMode}`))]) {
  const [pageCountText, cacheMode] = groupKey.split('|');
  const pageCount = Number(pageCountText);
  const rows = summary.filter((row) => row.pageCount === pageCount && row.cacheMode === cacheMode);
  lines.push(`## 生成页 ${pageCount}（另有模板自带 2 页）· ${cacheModeLabels[cacheMode]}`, '');
  lines.push('| 指标 | ' + rows.map((row) => siteLabels[row.site]).join(' | ') + ' |');
  lines.push('| --- | ' + rows.map(() => '---').join(' | ') + ' |');
  const metric = (label, pick) => lines.push(`| ${label} | ${rows.map(pick).join(' | ')} |`);
  metric('运行情况', status);
  metric('启动到端口可连（秒）', (row) => seconds(row.startupMs));
  metric('第一次打开 /docs（秒）', (row) => seconds(row.firstPageMs));
  metric('第二页 /docs/test（毫秒）', (row) => milliseconds(row.secondPageMs));
  if (pageCount > 0) {
    metric(`依次打开 ${pageCount} 页总耗时（秒）`, (row) => seconds(row.crawlTotalMs));
    metric('其中单页中位数（毫秒）', (row) => milliseconds(row.crawlMedianMs));
    metric('其中单页 P95（毫秒）', (row) => milliseconds(row.crawlP95Ms));
  }
  metric('改 mdx 到页面更新（毫秒）', (row) => milliseconds(row.hmrMs));
  metric('内存峰值·工作集（MB）', (row) => megabytes(row.peakWorkingSet));
  metric('内存峰值·提交（MB）', (row) => megabytes(row.peakPrivateBytes));
  metric('启动后工作集（MB）', (row) => megabytes(row.afterStartupWorkingSet));
  metric('首页后工作集（MB）', (row) => megabytes(row.afterFirstPageWorkingSet));
  metric('首页后进程数', (row) => (row.processCountAfterFirstPage ?? '—'));
  metric('首页后主进程工作集（MB）', (row) => megabytes(row.mainProcessWorkingSetAfterFirstPage));
  if (pageCount > 0) metric('打开全部页后工作集（MB）', (row) => megabytes(row.afterCrawlWorkingSet));
  metric('空闲 60 秒后工作集（MB）', (row) => megabytes(row.idleEndWorkingSet));
  lines.push('');
}
writeFileSync(join(resultsDir, 'summary.md'), `${lines.join('\n')}\n`);
console.log(lines.join('\n'));
