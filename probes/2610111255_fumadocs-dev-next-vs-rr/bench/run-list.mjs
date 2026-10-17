// 按清单每个站只跑一次：node run-list.mjs <页数> <cold|cold+warm> <站…>
// cold+warm：每个站先冷启动一次，紧接着保留缓存再热启动一次（优化变体共用一个站目录，缓存必须是同一变体刚留下的）。
import { spawnSync } from 'node:child_process';
import { appendFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { writeGeneratedPages } from './gen-pages.mjs';

const benchDir = dirname(fileURLToPath(import.meta.url));
const unitDir = join(benchDir, '..');
const resultsDir = join(unitDir, 'results');
const siteDirBySiteKey = (siteKey) => {
  if (siteKey === 'next') return 'site-next';
  if (siteKey === 'next-async') return 'site-next-async';
  if (siteKey === 'rr') return 'site-rr';
  if (siteKey.startsWith('next-')) return 'site-next-tuned';
  throw new Error(`不认识的站「${siteKey}」`);
};

const [pageCountArg, plan, ...siteKeys] = process.argv.slice(2);
const pageCount = Number(pageCountArg);
if (!Number.isInteger(pageCount) || !['cold', 'cold+warm'].includes(plan) || siteKeys.length === 0) {
  console.error('用法：node run-list.mjs <页数> <cold|cold+warm> <站…>');
  process.exit(2);
}

mkdirSync(resultsDir, { recursive: true });
const progress = (message) => {
  const line = `${new Date().toISOString()} ${message}`;
  console.log(line);
  appendFileSync(join(resultsDir, 'progress.log'), `${line}\n`);
};

function runBench(siteKey, cacheMode) {
  progress(`开始 ${siteKey} ${pageCount} 页 ${cacheMode}`);
  const child = spawnSync(process.execPath, [join(benchDir, 'bench.mjs'), siteKey, String(pageCount), '1', '60', cacheMode], {
    stdio: ['ignore', 'pipe', 'inherit'],
    encoding: 'utf8',
  });
  if (child.status !== 0) throw new Error(`bench.mjs ${siteKey} ${pageCount} ${cacheMode} 退出码 ${child.status}`);
  const result = JSON.parse(child.stdout);
  const outcome = result.error ?? (result.overLimit ? `超限（${result.overLimit.phase}）` : '完成');
  progress(`结束 ${siteKey} ${pageCount} 页 ${cacheMode}：${outcome}，首页 ${(result.phases.firstPageMs / 1000).toFixed(1)} 秒，峰值 ${(result.memory.peak.workingSet / 1024 ** 2).toFixed(0)} MB，首页后 ${result.processesAfterFirstPage?.length ?? '—'} 个进程`);
}

for (const siteDir of new Set(siteKeys.map(siteDirBySiteKey))) writeGeneratedPages(join(unitDir, siteDir), pageCount);
for (const siteKey of siteKeys) {
  runBench(siteKey, 'cold');
  if (plan === 'cold+warm') runBench(siteKey, 'warm');
}
progress('清单跑完');
