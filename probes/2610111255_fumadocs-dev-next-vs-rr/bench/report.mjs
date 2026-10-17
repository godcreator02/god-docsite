// 生成 results/report.html：每档页数一张内存曲线（进程树工作集随时间）与一张进程数曲线，附汇总表。
// 用法：node report.mjs（先跑 summarize.mjs 生成 summary.md）
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const resultsDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'results');
// 主批次的记录没有 cacheMode 字段，都是冷启动；prime 只是给热启动生成缓存，不画
const runs = readFileSync(join(resultsDir, 'raw.jsonl'), 'utf8')
  .trim()
  .split('\n')
  .map((line) => JSON.parse(line))
  // 早期版本的 bench.mjs 在超限时把超限说明也写进了 error，这里按超限处理
  .map((run) => ({ ...run, cacheMode: run.cacheMode ?? 'cold', error: run.overLimit ? null : run.error }))
  .filter((run) => run.cacheMode !== 'prime');
const chartRuns = runs.map((run) => ({
  site: run.site,
  pageCount: run.pageCount,
  cacheMode: run.cacheMode,
  run: run.run,
  overLimit: run.overLimit,
  error: run.error,
  // 每个点是 [毫秒, 工作集 MB, 进程数, 阶段]
  points: JSON.parse(readFileSync(join(resultsDir, run.seriesFile), 'utf8')).map((sample) => [
    sample.ms,
    Math.round(sample.workingSet / 1024 ** 2),
    sample.processCount,
    sample.phase,
  ]),
}));
const summaryMarkdown = readFileSync(join(resultsDir, 'summary.md'), 'utf8');

const html = `<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>fumadocs dev 内存曲线</title>
<style>
:root {
  color-scheme: light;
  --surface: #fcfcfb; --page: #f9f9f7; --ink: #0b0b0b; --ink-2: #52514e; --muted: #898781;
  --grid: #e1e0d9; --axis: #c3c2b7; --border: rgba(11,11,11,0.10);
  --series-1: #2a78d6; --series-2: #eb6834; --series-3: #1baf7a; --series-4: #eda100;
}
@media (prefers-color-scheme: dark) {
  :root:where(:not([data-theme="light"])) {
    color-scheme: dark;
    --surface: #1a1a19; --page: #0d0d0d; --ink: #ffffff; --ink-2: #c3c2b7; --muted: #898781;
    --grid: #2c2c2a; --axis: #383835; --border: rgba(255,255,255,0.10);
    --series-1: #3987e5; --series-2: #d95926; --series-3: #199e70; --series-4: #c98500;
  }
}
:root[data-theme="dark"] {
  color-scheme: dark;
  --surface: #1a1a19; --page: #0d0d0d; --ink: #ffffff; --ink-2: #c3c2b7; --muted: #898781;
  --grid: #2c2c2a; --axis: #383835; --border: rgba(255,255,255,0.10);
  --series-1: #3987e5; --series-2: #d95926; --series-3: #199e70; --series-4: #c98500;
}
* { box-sizing: border-box; }
body { margin: 0; background: var(--page); color: var(--ink); font: 14px/1.6 system-ui, -apple-system, "Segoe UI", sans-serif; }
main { max-width: 1040px; margin: 0 auto; padding: 24px 16px 48px; }
h1 { font-size: 22px; margin: 0 0 4px; }
h2 { font-size: 17px; margin: 32px 0 8px; }
p.note { color: var(--ink-2); margin: 4px 0 12px; }
.card { background: var(--surface); border: 1px solid var(--border); border-radius: 8px; padding: 12px 12px 4px; margin-bottom: 12px; position: relative; }
.card h3 { font-size: 14px; font-weight: 600; margin: 0 0 4px; color: var(--ink); }
.legend { display: flex; gap: 16px; flex-wrap: wrap; color: var(--ink-2); font-size: 13px; margin: 8px 0 16px; }
.legend span::before { content: ""; display: inline-block; width: 16px; height: 2px; vertical-align: middle; margin-right: 6px; background: var(--key); }
svg { width: 100%; height: auto; display: block; overflow: visible; }
svg text { fill: var(--muted); font-size: 11px; font-variant-numeric: tabular-nums; }
.tooltip { position: absolute; pointer-events: none; background: var(--surface); border: 1px solid var(--border); border-radius: 6px; padding: 6px 8px; font-size: 12px; box-shadow: 0 2px 8px rgba(0,0,0,0.12); display: none; min-width: 210px; z-index: 2; }
.tooltip .row { display: flex; gap: 6px; align-items: center; white-space: nowrap; }
.tooltip .row b { font-variant-numeric: tabular-nums; min-width: 64px; text-align: right; }
.tooltip .row i { display: inline-block; width: 12px; height: 2px; }
.tooltip .row small { color: var(--ink-2); }
.tooltip .time { color: var(--ink-2); margin-bottom: 2px; }
.table-wrap { overflow-x: auto; }
table { border-collapse: collapse; font-size: 13px; background: var(--surface); margin: 8px 0 16px; }
th, td { border: 1px solid var(--grid); padding: 4px 8px; text-align: right; font-variant-numeric: tabular-nums; }
th:first-child, td:first-child { text-align: left; }
</style>
</head>
<body>
<main>
<h1>fumadocs dev 模式内存曲线</h1>
<p class="note">纵轴是 dev 服务整棵进程树的工作集（含 Turbopack 的 Node 工作进程），每 250 ms 采样一次；横轴是从启动 dev 起的秒数。每组每个站跑 3 次，同色的 3 条线就是这 3 次。冷启动每次先删掉编译缓存；热启动保留上一次运行留下的缓存。虚线是脚本的内存上限：Next 6 GB、Vite 2 GB。鼠标移到图上看每条线在该时刻的数值与所处阶段。</p>
<div class="legend" id="legend"></div>
<div id="charts"></div>
<h2>汇总表</h2>
<div class="table-wrap" id="summary"></div>
</main>
<script>
const runs = ${JSON.stringify(chartRuns)};
const summaryMarkdown = ${JSON.stringify(summaryMarkdown)};
const sites = [
  { key: 'next', label: 'Next（默认，全部导入）', color: 'var(--series-1)', limitMb: 6144 },
  { key: 'next-async', label: 'Next（按页懒加载）', color: 'var(--series-2)', limitMb: 6144 },
  { key: 'rr', label: 'Vite + React Router', color: 'var(--series-3)', limitMb: 2048 },
  { key: 'next-lean', label: 'Next（省内存配置）', color: 'var(--series-4)', limitMb: 6144 },
];
const cacheModeLabels = { cold: '冷启动（先删缓存）', warm: '热启动（保留缓存）' };
const phaseLabels = { startup: '启动', firstPage: '首页', secondPage: '第二页', crawl: '依次打开全部页', hmr: '热更新', idle: '空闲' };
const svgNs = 'http://www.w3.org/2000/svg';

const legend = document.getElementById('legend');
for (const site of sites) {
  const item = document.createElement('span');
  item.style.setProperty('--key', site.color);
  item.textContent = site.label;
  legend.append(item);
}

function element(name, attributes, parent) {
  const node = document.createElementNS(svgNs, name);
  for (const [key, value] of Object.entries(attributes)) node.setAttribute(key, value);
  parent.append(node);
  return node;
}

function niceStep(max, targetTicks) {
  const raw = max / targetTicks;
  const magnitude = 10 ** Math.floor(Math.log10(raw));
  return [1, 2, 5, 10].map((factor) => factor * magnitude).find((step) => step >= raw);
}

function nearestPoint(points, ms) {
  let low = 0;
  let high = points.length - 1;
  while (low < high) {
    const middle = (low + high) >> 1;
    if (points[middle][0] < ms) low = middle + 1;
    else high = middle;
  }
  if (low > 0 && Math.abs(points[low - 1][0] - ms) < Math.abs(points[low][0] - ms)) low--;
  return points[low];
}

function drawChart(container, title, tierRuns, valueIndex, unit, limitLines) {
  const card = document.createElement('div');
  card.className = 'card';
  const heading = document.createElement('h3');
  heading.textContent = title;
  card.append(heading);
  container.append(card);

  const width = 980, height = 300, left = 56, right = 140, top = 12, bottom = 32;
  const maxMs = Math.max(...tierRuns.map((run) => run.points.at(-1)?.[0] ?? 0));
  const dataMax = Math.max(...tierRuns.flatMap((run) => run.points.map((point) => point[valueIndex])));
  const visibleLimits = limitLines.filter((limit) => limit.value <= dataMax * 1.3);
  const maxValue = Math.max(dataMax, ...visibleLimits.map((limit) => limit.value)) * 1.08;
  const x = (ms) => left + (ms / maxMs) * (width - left - right);
  const y = (value) => top + (1 - value / maxValue) * (height - top - bottom);

  const svg = element('svg', { viewBox: \`0 0 \${width} \${height}\`, role: 'img', 'aria-label': title }, card);
  const yStep = niceStep(maxValue, 5);
  for (let value = 0; value <= maxValue; value += yStep) {
    element('line', { x1: left, x2: width - right, y1: y(value), y2: y(value), stroke: value === 0 ? 'var(--axis)' : 'var(--grid)', 'stroke-width': 1 }, svg);
    element('text', { x: left - 6, y: y(value) + 4, 'text-anchor': 'end' }, svg).textContent = value;
  }
  element('text', { x: left - 6, y: top - 2, 'text-anchor': 'end' }, svg).textContent = unit;
  const xStep = niceStep(maxMs / 1000, 8);
  for (let second = 0; second <= maxMs / 1000; second += xStep) {
    element('text', { x: x(second * 1000), y: height - bottom + 16, 'text-anchor': 'middle' }, svg).textContent = second + ' 秒';
  }
  for (const limit of visibleLimits) {
    element('line', { x1: left, x2: width - right, y1: y(limit.value), y2: y(limit.value), stroke: 'var(--muted)', 'stroke-width': 1, 'stroke-dasharray': '4 4' }, svg);
    element('text', { x: width - right + 4, y: y(limit.value) + 4 }, svg).textContent = limit.label;
  }

  const lastPointBySite = new Map();
  for (const run of tierRuns) {
    const site = sites.find((candidate) => candidate.key === run.site);
    const path = run.points.map((point, index) => \`\${index === 0 ? 'M' : 'L'}\${x(point[0]).toFixed(1)},\${y(point[valueIndex]).toFixed(1)}\`).join('');
    element('path', { d: path, fill: 'none', stroke: site.color, 'stroke-width': 1.5, 'stroke-linejoin': 'round', opacity: 0.85 }, svg);
    const last = run.points.at(-1);
    if (last && (!lastPointBySite.has(site.key) || last[valueIndex] > lastPointBySite.get(site.key)[valueIndex])) lastPointBySite.set(site.key, last);
  }
  const labelYs = [];
  for (const site of sites) {
    const last = lastPointBySite.get(site.key);
    if (!last) continue;
    let labelY = y(last[valueIndex]) + 4;
    while (labelYs.some((used) => Math.abs(used - labelY) < 13)) labelY += 13;
    labelYs.push(labelY);
    element('text', { x: width - right + 4, y: labelY, style: 'fill: var(--ink-2)' }, svg).textContent = site.label;
  }

  const crosshair = element('line', { y1: top, y2: height - bottom, stroke: 'var(--axis)', 'stroke-width': 1, visibility: 'hidden' }, svg);
  const tooltip = document.createElement('div');
  tooltip.className = 'tooltip';
  card.append(tooltip);
  const hitArea = element('rect', { x: left, y: top, width: width - left - right, height: height - top - bottom, fill: 'transparent' }, svg);
  hitArea.addEventListener('pointermove', (event) => {
    const box = svg.getBoundingClientRect();
    const svgX = ((event.clientX - box.left) / box.width) * width;
    const ms = Math.max(0, Math.min(maxMs, ((svgX - left) / (width - left - right)) * maxMs));
    crosshair.setAttribute('x1', x(ms));
    crosshair.setAttribute('x2', x(ms));
    crosshair.setAttribute('visibility', 'visible');
    tooltip.replaceChildren();
    const time = document.createElement('div');
    time.className = 'time';
    time.textContent = (ms / 1000).toFixed(1) + ' 秒';
    tooltip.append(time);
    for (const run of tierRuns) {
      if (run.points.length === 0 || ms > run.points.at(-1)[0] + 500) continue;
      const point = nearestPoint(run.points, ms);
      const site = sites.find((candidate) => candidate.key === run.site);
      const row = document.createElement('div');
      row.className = 'row';
      const key = document.createElement('i');
      key.style.background = site.color;
      const value = document.createElement('b');
      value.textContent = point[valueIndex] + ' ' + unit;
      const label = document.createElement('small');
      label.textContent = site.label + ' 第' + run.run + '次 · ' + phaseLabels[point[3]];
      row.append(key, value, label);
      tooltip.append(row);
    }
    tooltip.style.display = 'block';
    const cardBox = card.getBoundingClientRect();
    const tooltipX = event.clientX - cardBox.left + 14;
    tooltip.style.left = Math.min(tooltipX, cardBox.width - tooltip.offsetWidth - 8) + 'px';
    tooltip.style.top = (event.clientY - cardBox.top + 14) + 'px';
  });
  hitArea.addEventListener('pointerleave', () => {
    crosshair.setAttribute('visibility', 'hidden');
    tooltip.style.display = 'none';
  });
}

const charts = document.getElementById('charts');
const groupKeys = [...new Set(runs.map((run) => run.pageCount + '|' + run.cacheMode))].sort((a, b) => {
  const [pagesA, modeA] = a.split('|');
  const [pagesB, modeB] = b.split('|');
  return Number(pagesA) - Number(pagesB) || Object.keys(cacheModeLabels).indexOf(modeA) - Object.keys(cacheModeLabels).indexOf(modeB);
});
for (const groupKey of groupKeys) {
  const [pageCountText, cacheMode] = groupKey.split('|');
  const pageCount = Number(pageCountText);
  const tierRuns = runs.filter((run) => run.pageCount === pageCount && run.cacheMode === cacheMode);
  const section = document.createElement('section');
  const heading = document.createElement('h2');
  heading.textContent = (pageCount === 0 ? '只有模板自带 2 页' : \`生成 \${pageCount} 页（另有模板自带 2 页）\`) + ' · ' + cacheModeLabels[cacheMode];
  section.append(heading);
  const failures = tierRuns.filter((run) => run.overLimit || run.error);
  if (failures.length > 0) {
    const note = document.createElement('p');
    note.className = 'note';
    note.textContent = failures.map((run) => {
      const site = sites.find((candidate) => candidate.key === run.site);
      return \`\${site.label} 第\${run.run}次：\${run.overLimit ? '在「' + phaseLabels[run.overLimit.phase] + '」阶段超过上限被停掉' : run.error}\`;
    }).join('；');
    section.append(note);
  }
  charts.append(section);
  drawChart(section, '进程树工作集', tierRuns, 1, 'MB', [{ value: 2048, label: '2 GB 上限' }, { value: 6144, label: '6 GB 上限' }]);
  drawChart(section, '进程数', tierRuns, 2, '个', []);
}

const summary = document.getElementById('summary');
for (const block of summaryMarkdown.split('\\n## ').slice(1)) {
  const lines = block.trim().split('\\n');
  const heading = document.createElement('h3');
  heading.textContent = lines[0];
  summary.append(heading);
  const table = document.createElement('table');
  const rows = lines.filter((line) => line.startsWith('|') && !line.startsWith('| ---'));
  rows.forEach((line, index) => {
    const tr = document.createElement('tr');
    for (const cell of line.split('|').slice(1, -1)) {
      const td = document.createElement(index === 0 ? 'th' : 'td');
      td.textContent = cell.trim();
      tr.append(td);
    }
    table.append(tr);
  });
  summary.append(table);
}
</script>
</body>
</html>
`;
writeFileSync(join(resultsDir, 'report.html'), html);
console.log(`已写出 ${join(resultsDir, 'report.html')}`);
