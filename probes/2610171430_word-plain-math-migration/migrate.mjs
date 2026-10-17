// 把一份 MDX 报告迁到 word-report 0.5.0 的写法：组件名加 Word 前缀；0.4.2 引擎会写成文字的 $…$ 改写成 <WordPlainMath>。
// 用法：node migrate.mjs <报告目录> <python.exe> [--write]
// 不带 --write 只核对、写出 mapping.tsv；带 --write 核对通过后才改写报告目录里的 .mdx。
// 编译器取 packages/word-report 构建好的 dist/core.mjs（先在那里 pnpm build），解析器与它用同一套 remark 插件
import { spawnSync } from 'node:child_process';
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { compileMdxReport } from '../../packages/word-report/dist/core.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const requireFromPackage = createRequire(path.join(here, '../../packages/word-report/package.json'));
const load = async (name) => (await import(pathToFileURL(requireFromPackage.resolve(name)).href)).default;
const { unified } = await import(pathToFileURL(requireFromPackage.resolve('unified')).href);
const parser = unified().use(await load('remark-parse')).use(await load('remark-frontmatter'), ['yaml']).use(await load('remark-mdx')).use(await load('remark-gfm')).use(await load('remark-math'));
const parseMdx = (text) => parser.parse(text);
const [reportDir, python, ...flags] = process.argv.slice(2);
if (!reportDir || !python || flags.some((flag) => flag !== '--write')) throw new Error('用法：node migrate.mjs <报告目录> <python.exe> [--write]');
const write = flags.includes('--write');

const NAMES = 'Figures|Figure|Panel|Table|Caption|Ref|Cite|Abstract|Reference|Bibliography';
const renamed = (text) => text.replace(new RegExp(`<(/?)(${NAMES})(?=[\\s/>])`, 'g'), '<$1Word$2');

const files = readdirSync(reportDir).filter((name) => name.endsWith('.mdx')).sort();
const sources = Object.fromEntries(files.map((name) => [name, renamed(readFileSync(path.join(reportDir, name), 'utf8'))]));

function inlineMathOf(tree) {
  const found = [];
  const visit = (node) => {
    if (node.type === 'inlineMath') found.push(node);
    for (const child of node.children ?? []) visit(child);
  };
  visit(tree);
  return found;
}

const mathByFile = Object.fromEntries(files.map((name) => [name, inlineMathOf(parseMdx(sources[name], name))]));
const allTex = [...new Set(Object.values(mathByFile).flat().map((node) => node.value))];
const engine = spawnSync(python, ['-I', path.join(here, 'runs.py')], { input: JSON.stringify(allTex), encoding: 'utf8' });
if (engine.status !== 0) throw new Error(`runs.py 失败：${engine.stderr}`);
const runsOf = JSON.parse(engine.stdout);

const PUNCTUATION_OR_SPACE = /[\s\p{P}\p{S}]/u;
const escaped = (text) => text.replace(/[\\`*_{}[\]<>$|~&#@]/g, (character) => `\\${character}`);
function runMdx(run) {
  let written = escaped(run.text);
  if (run.italic) {
    const safe = !PUNCTUATION_OR_SPACE.test(run.text[0]) && !PUNCTUATION_OR_SPACE.test(run.text.at(-1));
    written = safe ? `*${written}*` : `<em>${written}</em>`;
  }
  return run.script ? `<${run.script}>${written}</${run.script}>` : written;
}
function texAttribute(tex) {
  if (!tex.includes('"')) return `tex="${tex}"`;
  if (!tex.includes("'")) return `tex='${tex}'`;
  return null;
}

const problems = [];
const migrated = {};
let converted = 0, kept = 0;
for (const name of files) {
  let text = sources[name];
  for (const node of [...mathByFile[name]].reverse()) {
    const runs = runsOf[node.value];
    const attribute = texAttribute(node.value);
    if (!runs || !attribute) { kept += 1; if (runs && !attribute) problems.push(`${name}:${node.position.start.line}：tex 里同时有单双引号，保留 $…$`); continue; }
    const replacement = `<WordPlainMath ${attribute}>${runs.map(runMdx).join('')}</WordPlainMath>`;
    text = text.slice(0, node.position.start.offset) + replacement + text.slice(node.position.end.offset);
    converted += 1;
  }
  migrated[name] = text;
}

// 核对：迁移前（只改名）与迁移后各编译一次，除了多出的 plainText 与 id 之外逐项相同，plainText 等于 0.4.2 引擎写出的文字
const compileAll = (texts) => compileMdxReport({ reportId: 'migration-check', entry: 'reports/r/index.mdx', files: Object.fromEntries(Object.entries(texts).map(([name, text]) => [`reports/r/${name}`, text])) }).document;
const expectedPlainText = (runs) => runs.map((run) => {
  const marks = [...(run.italic ? ['em'] : []), ...(run.script ? [run.script] : [])];
  return marks.length ? { text: run.text, marks } : { text: run.text };
});
function compare(before, after, at) {
  if (Array.isArray(before)) {
    if (!Array.isArray(after) || after.length !== before.length) return problems.push(`${at}：数组长度不同`);
    before.forEach((item, index) => compare(item, after[index], `${at}/${index}`));
    return;
  }
  if (before && typeof before === 'object') {
    if (before.type === 'math' && after?.type === 'math' && after.plainText) {
      if (after.latex !== before.latex) problems.push(`${at}：latex 变了`);
      const runs = runsOf[before.latex];
      if (!runs || JSON.stringify(after.plainText) !== JSON.stringify(expectedPlainText(runs))) problems.push(`${at}：${before.latex} 的文字是 ${JSON.stringify(after.plainText)}`);
      return;
    }
    const keys = new Set([...Object.keys(before), ...Object.keys(after ?? {})].filter((key) => key !== 'id'));
    for (const key of keys) {
      if (key === 'alt') continue; // 不写 alt 的图取图题的纯文字，图题里的公式改成文字后 alt 跟着变
      compare(before[key], after?.[key], `${at}/${key}`);
    }
    return;
  }
  if (before !== after) problems.push(`${at}：${JSON.stringify(before)} → ${JSON.stringify(after)}`);
}
compare(compileAll(sources), compileAll(migrated), '');

const mapping = allTex.filter((tex) => runsOf[tex]).map((tex) => `${tex}\t${runsOf[tex].map(runMdx).join('')}`);
writeFileSync(path.join(here, 'mapping.tsv'), `tex\tWordPlainMath 里的文字\n${mapping.join('\n')}\n`);
console.log(JSON.stringify({ files: files.length, inlineMath: converted + kept, converted, keptAsMathType: kept, distinctConverted: mapping.length, problems: problems.slice(0, 20), problemCount: problems.length }, null, 2));
if (problems.length) process.exit(1);
if (write) for (const name of files) writeFileSync(path.join(reportDir, name), migrated[name]);
