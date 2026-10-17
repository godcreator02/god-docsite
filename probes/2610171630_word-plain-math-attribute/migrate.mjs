// 把 MDX 报告从 word-report 0.5.x 的写法迁到 0.6.0：
//   <WordPlainMath tex="X">Y</WordPlainMath> → <WordPlainMath word="Y">$X$</WordPlainMath>
//   <strong>Z</strong> → **Z**（迁移后编译结果不变才算数，否则整批不写）
// 用法：node migrate.mjs <报告目录> <0.5.x 的 dist/core.mjs> <0.6.0 的 dist/core.mjs> [--write]
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const [reportDir, oldCore, newCore, ...flags] = process.argv.slice(2);
if (!reportDir || !oldCore || !newCore || flags.some((flag) => flag !== '--write')) throw new Error('用法：node migrate.mjs <报告目录> <0.5.x 的 core.mjs> <0.6.0 的 core.mjs> [--write]');
const { compileMdxReport: compileOld } = await import(pathToFileURL(path.resolve(oldCore)).href);
const { compileMdxReport: compileNew } = await import(pathToFileURL(path.resolve(newCore)).href);

const files = readdirSync(reportDir).filter((name) => name.endsWith('.mdx')).sort();
const before = Object.fromEntries(files.map((name) => [name, readFileSync(path.join(reportDir, name), 'utf8')]));

const problems = [];
let plainMath = 0, strong = 0;
function quoted(value, at) {
  if (!value.includes('"')) return `"${value}"`;
  if (!value.includes("'")) return `'${value}'`;
  problems.push(`${at}：Word 文字里同时有单双引号，写不成属性`);
  return '""';
}
const after = Object.fromEntries(files.map((name) => {
  const text = before[name]
    .replace(/<WordPlainMath tex=(?:"([^"]*)"|'([^']*)')>([\s\S]*?)<\/WordPlainMath>/g, (_whole, double, single, word) => {
      plainMath += 1;
      const tex = double ?? single;
      if (tex.includes('$')) problems.push(`${name}：${tex} 里有 $`);
      return `<WordPlainMath word=${quoted(word, name)}>$${tex}$</WordPlainMath>`;
    })
    .replace(/<strong>([^<]*)<\/strong>/g, (_whole, inner) => { strong += 1; return `**${inner}**`; });
  return [name, text];
}));
for (const name of files) if (/<WordPlainMath tex=|<strong>/.test(after[name])) problems.push(`${name}：还有没迁的 <WordPlainMath tex=…> 或 <strong>`);

const compileWith = (compile, texts) => compile({ reportId: 'migration-check', entry: 'reports/r/index.mdx', files: Object.fromEntries(Object.entries(texts).map(([name, text]) => [`reports/r/${name}`, text])) }).document;
const oldDocument = JSON.stringify(compileWith(compileOld, before));
const newDocument = JSON.stringify(compileWith(compileNew, after));
if (oldDocument !== newDocument) {
  const at = [...oldDocument].findIndex((character, index) => character !== newDocument[index]);
  problems.push(`迁移前后编译结果不同，第 ${at} 个字符起：旧 ${oldDocument.slice(at - 80, at + 80)} ／ 新 ${newDocument.slice(at - 80, at + 80)}`);
}

console.log(JSON.stringify({ files: files.length, plainMath, strong, identicalDocument: oldDocument === newDocument, problems }, null, 2));
if (problems.length) process.exit(1);
if (flags.includes('--write')) for (const name of files) writeFileSync(path.join(reportDir, name), after[name]);
