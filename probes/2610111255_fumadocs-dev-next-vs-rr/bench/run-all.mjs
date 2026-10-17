// 跑全部组合：页数 0 / 100 / 500 三档，每档每个站冷启动 3 次，站之间交替跑，减少机器状态漂移带来的偏差。
// 用法：node run-all.mjs；进度写到 results/progress.log，结果由 bench.mjs 追加到 results/raw.jsonl。
import { spawnSync } from 'node:child_process';
import { appendFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { writeGeneratedPages } from './gen-pages.mjs';

const benchDir = dirname(fileURLToPath(import.meta.url));
const unitDir = join(benchDir, '..');
const resultsDir = join(unitDir, 'results');
const siteDirs = { next: 'site-next', 'next-async': 'site-next-async', rr: 'site-rr' };
const pageCounts = [0, 100, 500];
const runsPerCombination = 3;

mkdirSync(resultsDir, { recursive: true });
const progress = (message) => {
  const line = `${new Date().toISOString()} ${message}`;
  console.log(line);
  appendFileSync(join(resultsDir, 'progress.log'), `${line}\n`);
};

for (const pageCount of pageCounts) {
  for (const siteDir of Object.values(siteDirs)) writeGeneratedPages(join(unitDir, siteDir), pageCount);
  for (let run = 1; run <= runsPerCombination; run++) {
    for (const siteKey of Object.keys(siteDirs)) {
      progress(`开始 ${siteKey} ${pageCount} 页 第 ${run} 次`);
      const child = spawnSync(process.execPath, [join(benchDir, 'bench.mjs'), siteKey, String(pageCount), String(run)], {
        stdio: ['ignore', 'pipe', 'inherit'],
        encoding: 'utf8',
      });
      if (child.status !== 0) throw new Error(`bench.mjs ${siteKey} ${pageCount} ${run} 退出码 ${child.status}`);
      const result = JSON.parse(child.stdout);
      progress(`结束 ${siteKey} ${pageCount} 页 第 ${run} 次：${result.error ?? (result.overLimit ? '超限' : '完成')}，峰值 ${(result.memory.peak.workingSet / 1024 ** 2).toFixed(0)} MB`);
    }
  }
}
progress('全部完成');
