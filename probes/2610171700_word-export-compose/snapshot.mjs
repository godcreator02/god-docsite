// 把站点里的一份报告组装成 Word 引擎的输入（content.json 加 assets/），和 report-docx export 写进 input/ 的一样
// 用法：node snapshot.mjs <站点目录> <报告 id> <输出目录> [<章 id…>]；给了章 id 就只留这几章（加文献表），指到样本外的引用改成文字
import { cpSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const [site, reportId, out, ...chapters] = process.argv.slice(2);
if (!site || !reportId || !out) throw new Error('用法：node snapshot.mjs <站点目录> <报告 id> <输出目录> [<章 id…>]');
if (existsSync(out)) throw new Error(`${out} 已经存在：换一个新目录`);
const { readReport } = await import(pathToFileURL(path.join(site, 'node_modules/@godcreator/word-report/dist/node.mjs')).href);
const report = await readReport(path.join(site, 'reports', reportId, 'index.mdx'), { root: site, mode: 'complete' });
const document = report.document;

let dropped = 0;
if (chapters.length) {
  document.blocks = document.blocks.filter((block) => chapters.includes(block.id) || block.type === 'bibliography' || block.type === 'abstract');
  const kept = new Set();
  (function collect(value) {
    if (Array.isArray(value)) return value.forEach(collect);
    if (!value || typeof value !== 'object') return;
    if (typeof value.id === 'string') kept.add(value.id);
    Object.values(value).forEach(collect);
  })(document.blocks);
  (function rewrite(value) {
    if (Array.isArray(value)) {
      value.forEach((item, index) => { if (item?.type === 'ref' && !kept.has(item.target)) { value[index] = { type: 'text', text: '第 x 节' }; dropped += 1; } });
      return value.forEach(rewrite);
    }
    if (!value || typeof value !== 'object') return;
    Object.values(value).forEach(rewrite);
  })(document.blocks);
}

// 引擎还不会排一个图号下的多张图：测时只看耗时，换成第一张子图的单图
let singledFigures = 0;
const figureOfPanel = new Map();
(function single(value) {
  if (Array.isArray(value)) return value.forEach(single);
  if (!value || typeof value !== 'object') return;
  if (value.type === 'figure' && value.panels) {
    const [first] = value.panels;
    for (const panel of value.panels) figureOfPanel.set(panel.id, value.id);
    value.src = first.src;
    value.alt = first.alt;
    delete value.panels; delete value.rows; delete value.columns;
    singledFigures += 1;
  }
  Object.values(value).forEach(single);
})(document.blocks);
(function retarget(value) {
  if (Array.isArray(value)) return value.forEach(retarget);
  if (!value || typeof value !== 'object') return;
  if (value.type === 'ref' && figureOfPanel.has(value.target)) value.target = figureOfPanel.get(value.target);
  Object.values(value).forEach(retarget);
})(document.blocks);

mkdirSync(out, { recursive: true });
writeFileSync(path.join(out, 'content.json'), JSON.stringify(document, null, 2) + '\n');
for (const [relative, bytes] of Object.entries(report.assetBytes)) {
  const file = path.join(out, relative);
  mkdirSync(path.dirname(file), { recursive: true });
  writeFileSync(file, bytes);
}
const layout = path.join(site, 'reports', reportId, 'layout.json');
if (!chapters.length && existsSync(layout)) cpSync(layout, path.join(out, '..', `${path.basename(out)}-layout.json`));
console.log(JSON.stringify({ blocks: document.blocks.length, assets: Object.keys(report.assetBytes).length, droppedRefs: dropped, singledFigures, sectionIds: document.blocks.filter((block) => block.type === 'section').map((block) => block.id) }));
