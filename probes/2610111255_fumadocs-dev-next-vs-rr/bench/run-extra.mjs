// 第二批：Next 省内存配置（next-lean）的冷启动，加四个站的热启动（保留上一次的编译缓存），100 / 500 两档页数。
// 用法：node run-extra.mjs；进度追加到 results/progress.log，结果由 bench.mjs 追加到 results/raw.jsonl。
import { spawnSync } from 'node:child_process';
import { appendFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { writeGeneratedPages } from './gen-pages.mjs';

const benchDir = dirname(fileURLToPath(import.meta.url));
const unitDir = join(benchDir, '..');
const resultsDir = join(unitDir, 'results');
const siteDirs = { next: 'site-next', 'next-async': 'site-next-async', 'next-lean': 'site-next-lean', rr: 'site-rr' };
const pageCounts = [100, 500];
const runsPerCombination = 3;

mkdirSync(resultsDir, { recursive: true });
const progress = (message) => {
  const line = `${new Date().toISOString()} ${message}`;
  console.log(line);
  appendFileSync(join(resultsDir, 'progress.log'), `${line}\n`);
};

function runBench(siteKey, pageCount, run, cacheMode) {
  progress(`开始 ${siteKey} ${pageCount} 页 ${cacheMode} 第 ${run} 次`);
  const child = spawnSync(process.execPath, [join(benchDir, 'bench.mjs'), siteKey, String(pageCount), String(run), '60', cacheMode], {
    stdio: ['ignore', 'pipe', 'inherit'],
    encoding: 'utf8',
  });
  if (child.status !== 0) throw new Error(`bench.mjs ${siteKey} ${pageCount} ${run} ${cacheMode} 退出码 ${child.status}`);
  const result = JSON.parse(child.stdout);
  progress(`结束 ${siteKey} ${pageCount} 页 ${cacheMode} 第 ${run} 次：${result.error ?? (result.overLimit ? '超限' : '完成')}，峰值 ${(result.memory.peak.workingSet / 1024 ** 2).toFixed(0)} MB`);
}

for (const pageCount of pageCounts) {
  for (const siteDir of Object.values(siteDirs)) writeGeneratedPages(join(unitDir, siteDir), pageCount);
  for (let run = 1; run <= runsPerCombination; run++) runBench('next-lean', pageCount, run, 'cold');
  // next-lean 刚跑完冷启动，缓存已经和当前页面一致；其余三个站的缓存还是上一档页数留下的，先各跑一次生成缓存
  for (const siteKey of ['next', 'next-async', 'rr']) runBench(siteKey, pageCount, 0, 'prime');
  for (let run = 1; run <= runsPerCombination; run++) {
    for (const siteKey of Object.keys(siteDirs)) runBench(siteKey, pageCount, run, 'warm');
  }
}
progress('第二批全部完成');
