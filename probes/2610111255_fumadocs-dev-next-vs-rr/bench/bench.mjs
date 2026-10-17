// 跑一次 dev 模式测量：清缓存 → 启动 dev → 首页 → 第二页 → 依次打开全部页面 → 改 mdx 测热更新 → 空闲 → 停掉整棵进程树。
// 用法：node bench.mjs <站> <生成页数> <第几次> [空闲秒数=60] [cold|warm|prime，默认 cold]；站名见下面的 sites
// 结果 JSON 追加到 results/raw.jsonl，dev 服务的输出写到 results/logs/。
import { spawn, execFileSync } from 'node:child_process';
import { appendFileSync, createWriteStream, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { connect } from 'node:net';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { generatedPageSlugs, pageMarker } from './gen-pages.mjs';

const unitDir = join(dirname(fileURLToPath(import.meta.url)), '..');
const resultsDir = join(unitDir, 'results');
const runTimeoutMs = 10 * 60_000;
const requestTimeoutMs = 180_000;
const sampleIntervalMs = 250;

const nextDevArgs = (port) => ['node_modules/next/dist/bin/next', 'dev', '--port', String(port), '--hostname', '127.0.0.1'];
const nextVersionPackages = ['next', 'fumadocs-core', 'fumadocs-mdx', 'react'];

// 优化变体共用 site-next-tuned：它的 next.config.mjs 按 BENCH_NEXT_TUNING 打开选项，其余靠环境变量与命令行参数区分
function nextTunedVariants(variants) {
  return Object.fromEntries(
    Object.entries(variants).map(([key, { env = {}, extraArgs = [] }]) => [
      key,
      {
        dir: join(unitDir, 'site-next-tuned'),
        port: 4104,
        memoryLimitBytes: 6 * 1024 ** 3,
        env,
        args: (port) => [...nextDevArgs(port), ...extraArgs],
        cacheDirs: ['.next', '.source'],
        versionPackages: nextVersionPackages,
      },
    ]),
  );
}

// 内存上限按进程树工作集算：Next 只有模板两页时峰值就接近 2 GB，放宽到 6 GB 才测得出完整数据；Vite 那边保持 2 GB
const sites = {
  next: {
    dir: join(unitDir, 'site-next'),
    port: 4101,
    memoryLimitBytes: 6 * 1024 ** 3,
    args: nextDevArgs,
    cacheDirs: ['.next', '.source'],
    versionPackages: nextVersionPackages,
  },
  'next-async': {
    dir: join(unitDir, 'site-next-async'),
    port: 4103,
    memoryLimitBytes: 6 * 1024 ** 3,
    args: nextDevArgs,
    cacheDirs: ['.next', '.source'],
    versionPackages: nextVersionPackages,
  },
  ...nextTunedVariants({
    // 内存回收：turbopackMemoryEviction: 'full' 与 turbopackGc
    'next-lean': { env: { BENCH_NEXT_TUNING: 'evict' } },
    // 让 Turbopack 以为只有 4 / 2 个核，看 loader 子进程池会不会跟着变小
    'next-par4': { env: { TURBO_TASKS_AVAILABLE_PARALLELISM: '4' } },
    'next-par2': { env: { TURBO_TASKS_AVAILABLE_PARALLELISM: '2' } },
    'next-par1': { env: { TURBO_TASKS_AVAILABLE_PARALLELISM: '1' } },
    'next-par2-evict': { env: { TURBO_TASKS_AVAILABLE_PARALLELISM: '2', BENCH_NEXT_TUNING: 'evict' } },
    // next dev 在没设堆上限时把服务进程的 --max-old-space-size 定为物理内存的一半（本机约 16 GB），这里自己给一个小上限
    'next-heap1g': { env: { NODE_OPTIONS: '--max-old-space-size=1024' } },
    'next-par2-heap1g': { env: { TURBO_TASKS_AVAILABLE_PARALLELISM: '2', NODE_OPTIONS: '--max-old-space-size=1024' } },
    'next-par2-heap2g': { env: { TURBO_TASKS_AVAILABLE_PARALLELISM: '2', NODE_OPTIONS: '--max-old-space-size=2048' } },
    'next-par2-heap3g': { env: { TURBO_TASKS_AVAILABLE_PARALLELISM: '2', NODE_OPTIONS: '--max-old-space-size=3072' } },
    // loader 改在工作线程里跑：turbopackPluginRuntimeStrategy: 'forceWorkerThreads'
    'next-threads': { env: { BENCH_NEXT_TUNING: 'threads' } },
    'next-webpack': { env: { BENCH_NEXT_TUNING: 'webpack-memory' }, extraArgs: ['--webpack'] },
  }),
  rr: {
    dir: join(unitDir, 'site-rr'),
    port: 4102,
    memoryLimitBytes: 2 * 1024 ** 3,
    args: (port) => ['node_modules/@react-router/dev/bin.cjs', 'dev', '--port', String(port), '--host', '127.0.0.1', '--strictPort'],
    cacheDirs: ['.react-router', 'node_modules/.vite', 'build', '.source'],
    versionPackages: ['vite', 'react-router', '@react-router/dev', 'fumadocs-core', 'fumadocs-mdx', 'react'],
  },
};

class MemoryLimitExceeded extends Error {}

// 用一个常驻的 pwsh 每 250 ms 列一次全部进程（Node 没有取进程树的接口），由本进程按 ParentProcessId 算出 dev 服务那棵树
function startProcessTreeSampler(rootPid, onSample) {
  const script = `while ($true) { $rows = Get-CimInstance Win32_Process -Property ProcessId,ParentProcessId,WorkingSetSize,PrivatePageCount | ForEach-Object { "$($_.ProcessId),$($_.ParentProcessId),$($_.WorkingSetSize),$($_.PrivatePageCount)" }; [Console]::Out.WriteLine('S ' + ($rows -join ';')); [Console]::Out.Flush(); Start-Sleep -Milliseconds ${sampleIntervalMs} }`;
  const sampler = spawn('pwsh', ['-NoProfile', '-NonInteractive', '-Command', script], { windowsHide: true });
  let buffered = '';
  sampler.stdout.on('data', (chunk) => {
    buffered += chunk;
    let newline;
    while ((newline = buffered.indexOf('\n')) >= 0) {
      const line = buffered.slice(0, newline).trim();
      buffered = buffered.slice(newline + 1);
      if (line.startsWith('S ')) onSample(sumProcessTree(rootPid, line.slice(2)));
    }
  });
  return () => sampler.kill();
}

function sumProcessTree(rootPid, encodedRows) {
  const childrenByParent = new Map();
  const memoryByPid = new Map();
  for (const row of encodedRows.split(';')) {
    const [pid, parentPid, workingSet, privateBytes] = row.split(',').map(Number);
    memoryByPid.set(pid, { workingSet, privateBytes });
    if (!childrenByParent.has(parentPid)) childrenByParent.set(parentPid, []);
    childrenByParent.get(parentPid).push(pid);
  }
  let workingSet = 0;
  let privateBytes = 0;
  let processCount = 0;
  const pending = memoryByPid.has(rootPid) ? [rootPid] : [];
  while (pending.length > 0) {
    const pid = pending.pop();
    const memory = memoryByPid.get(pid);
    workingSet += memory.workingSet;
    privateBytes += memory.privateBytes;
    processCount++;
    for (const child of childrenByParent.get(pid) ?? []) if (child !== pid) pending.push(child);
  }
  return { at: performance.now(), workingSet, privateBytes, processCount };
}

// 一次性列出进程树里每个进程的命令行与内存，用来拆分是谁占的内存；常驻采样不带命令行，太长
function describeProcessTree(rootPid) {
  const script = `Get-CimInstance Win32_Process -Property ProcessId,ParentProcessId,WorkingSetSize,PrivatePageCount,Name,CommandLine | Select-Object ProcessId,ParentProcessId,WorkingSetSize,PrivatePageCount,Name,CommandLine | ConvertTo-Json -Compress`;
  const processes = JSON.parse(execFileSync('pwsh', ['-NoProfile', '-NonInteractive', '-Command', script], { encoding: 'utf8', maxBuffer: 64 * 1024 ** 2, windowsHide: true }));
  const childrenByParent = Map.groupBy(processes, (process) => process.ParentProcessId);
  const byPid = new Map(processes.map((process) => [process.ProcessId, process]));
  const tree = [];
  const pending = byPid.has(rootPid) ? [rootPid] : [];
  while (pending.length > 0) {
    const pid = pending.pop();
    const process = byPid.get(pid);
    tree.push({
      pid,
      parentPid: process.ParentProcessId,
      name: process.Name,
      workingSet: process.WorkingSetSize,
      privateBytes: process.PrivatePageCount,
      commandLine: (process.CommandLine ?? '').slice(0, 300),
    });
    for (const child of childrenByParent.get(pid) ?? []) if (child.ProcessId !== pid) pending.push(child.ProcessId);
  }
  return tree.sort((a, b) => b.workingSet - a.workingSet);
}

function waitForPort(port, deadline) {
  return new Promise((resolve, reject) => {
    const attempt = () => {
      const socket = connect(port, '127.0.0.1');
      socket.once('connect', () => {
        socket.destroy();
        resolve();
      });
      socket.once('error', () => {
        socket.destroy();
        if (performance.now() > deadline) reject(new Error(`端口 ${port} 在超时前没有打开`));
        else setTimeout(attempt, 100);
      });
    };
    attempt();
  });
}

async function timedGet(url) {
  const startedAt = performance.now();
  const response = await fetch(url, { signal: AbortSignal.timeout(requestTimeoutMs) });
  const body = await response.text();
  const elapsedMs = performance.now() - startedAt;
  if (response.status !== 200) throw new Error(`${url} 回 ${response.status}：${body.slice(0, 300)}`);
  return { elapsedMs, body };
}

function readVersions(siteDir, packageNames) {
  const versions = {};
  for (const name of packageNames) versions[name] = JSON.parse(readFileSync(join(siteDir, 'node_modules', name, 'package.json'), 'utf8')).version;
  return versions;
}

function percentile(sortedValues, fraction) {
  return sortedValues[Math.min(sortedValues.length - 1, Math.floor(sortedValues.length * fraction))];
}

function killProcessTree(pid) {
  try {
    execFileSync('taskkill', ['/pid', String(pid), '/T', '/F'], { stdio: 'ignore' });
  } catch (error) {
    // taskkill 在进程已经退出时返回 128，这正是想要的结果
    if (error.status !== 128) throw error;
  }
}

// cold：删掉编译缓存再启动；warm：保留上一次运行留下的缓存；prime：同 cold，只是为了给后面的 warm 生成缓存，汇总时不计入
const cacheModes = ['cold', 'warm', 'prime'];

async function runOnce(siteKey, pageCount, runIndex, idleSeconds, cacheMode) {
  const site = sites[siteKey];
  if (cacheMode !== 'warm') for (const cacheDir of site.cacheDirs) rmSync(join(site.dir, cacheDir), { recursive: true, force: true });
  const runLabel = cacheMode === 'cold' ? `${siteKey}-${pageCount}-${runIndex}` : `${siteKey}-${pageCount}-${cacheMode}-${runIndex}`;

  const benchDir = join(site.dir, 'content', 'docs', 'bench');
  const benchPageCount = existsSync(benchDir)
    ? readdirSync(benchDir, { recursive: true }).filter((entry) => entry.endsWith('.mdx')).length
    : 0;
  if (benchPageCount !== pageCount) throw new Error(`${site.dir} 里没有生成 ${pageCount} 页，先跑 gen-pages.mjs`);

  mkdirSync(join(resultsDir, 'logs'), { recursive: true });
  const logPath = join(resultsDir, 'logs', `${runLabel}.log`);
  const log = createWriteStream(logPath);

  const result = {
    site: siteKey,
    pageCount,
    run: runIndex,
    cacheMode,
    env: site.env ?? {},
    args: site.args(site.port).slice(1),
    startedAt: new Date().toISOString(),
    versions: readVersions(site.dir, site.versionPackages),
    node: process.version,
    phases: {},
    memory: {},
    overLimit: null,
    error: null,
  };

  const startedAt = performance.now();
  const server = spawn(process.execPath, site.args(site.port), {
    cwd: site.dir,
    env: { ...process.env, NEXT_TELEMETRY_DISABLED: '1', NODE_ENV: 'development', BROWSER: 'none', ...site.env },
    windowsHide: true,
  });
  server.stdout.pipe(log);
  server.stderr.pipe(log);

  let currentPhase = 'startup';
  let latestSample = null;
  let peak = { workingSet: 0, privateBytes: 0, processCount: 0, phase: null };
  let limitError = null;
  const memorySeries = [];
  const stopSampler = startProcessTreeSampler(server.pid, (sample) => {
    latestSample = sample;
    memorySeries.push({ ms: Math.round(sample.at - startedAt), phase: currentPhase, workingSet: sample.workingSet, privateBytes: sample.privateBytes, processCount: sample.processCount });
    if (sample.workingSet > peak.workingSet) peak = { ...sample, phase: currentPhase };
    if (sample.privateBytes > peak.privateBytes) peak.privateBytes = sample.privateBytes;
    if (sample.workingSet > site.memoryLimitBytes && limitError === null) {
      limitError = new MemoryLimitExceeded(`进程树工作集 ${(sample.workingSet / 1024 ** 2).toFixed(0)} MB 超过 ${site.memoryLimitBytes / 1024 ** 3} GB 上限（阶段 ${currentPhase}）`);
      result.overLimit = { phase: currentPhase, limitBytes: site.memoryLimitBytes, workingSet: sample.workingSet, privateBytes: sample.privateBytes, atMs: sample.at - startedAt };
      killProcessTree(server.pid);
    }
  });

  const serverExited = new Promise((_, reject) =>
    server.once('exit', (code) => reject(limitError ?? new Error(`dev 服务提前退出，退出码 ${code}，看 ${logPath}`))),
  );
  serverExited.catch(() => {});
  const withGuards = (promise) => Promise.race([promise, serverExited]);
  const snapshot = async (label) => {
    // 等下一次采样，保证读到的是这个时间点之后的内存
    const before = latestSample?.at ?? 0;
    while ((latestSample?.at ?? 0) <= before) await new Promise((resolve) => setTimeout(resolve, 50));
    result.memory[label] = { workingSet: latestSample.workingSet, privateBytes: latestSample.privateBytes, processCount: latestSample.processCount };
  };

  const runTimer = setTimeout(() => {
    limitError = new Error(`单次运行超过 ${runTimeoutMs / 60_000} 分钟`);
    killProcessTree(server.pid);
  }, runTimeoutMs);

  const baseUrl = `http://127.0.0.1:${site.port}`;
  const testPagePath = join(site.dir, 'content', 'docs', 'test.mdx');
  const testPageOriginal = readFileSync(testPagePath, 'utf8');

  try {
    await withGuards(waitForPort(site.port, startedAt + runTimeoutMs));
    result.phases.startupMs = performance.now() - startedAt;
    await withGuards(snapshot('afterStartup'));

    currentPhase = 'firstPage';
    result.phases.firstPageMs = (await withGuards(timedGet(`${baseUrl}/docs`))).elapsedMs;
    await withGuards(snapshot('afterFirstPage'));
    result.processesAfterFirstPage = describeProcessTree(server.pid);

    currentPhase = 'secondPage';
    result.phases.secondPageMs = (await withGuards(timedGet(`${baseUrl}/docs/test`))).elapsedMs;

    currentPhase = 'crawl';
    const crawlSlugs = generatedPageSlugs(pageCount);
    const crawlTimes = [];
    const crawlStartedAt = performance.now();
    for (const [position, slug] of crawlSlugs.entries()) {
      const { elapsedMs, body } = await withGuards(timedGet(`${baseUrl}/docs/${slug}`));
      if (!body.includes(pageMarker(position + 1))) throw new Error(`/docs/${slug} 的内容里没有 ${pageMarker(position + 1)}`);
      crawlTimes.push(elapsedMs);
    }
    if (crawlTimes.length > 0) {
      const sorted = [...crawlTimes].sort((a, b) => a - b);
      result.phases.crawl = {
        pages: crawlTimes.length,
        totalMs: performance.now() - crawlStartedAt,
        firstMs: crawlTimes[0],
        medianMs: percentile(sorted, 0.5),
        p95Ms: percentile(sorted, 0.95),
        maxMs: sorted.at(-1),
      };
    }
    await withGuards(snapshot('afterCrawl'));

    currentPhase = 'hmr';
    const hmrMarker = `hmr-marker-${Date.now()}`;
    writeFileSync(testPagePath, `${testPageOriginal}\n${hmrMarker}\n`);
    const hmrStartedAt = performance.now();
    for (;;) {
      const { body } = await withGuards(timedGet(`${baseUrl}/docs/test`));
      if (body.includes(hmrMarker)) break;
      if (performance.now() - hmrStartedAt > requestTimeoutMs) throw new Error('改了 test.mdx 之后页面一直没有更新');
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    result.phases.hmrMs = performance.now() - hmrStartedAt;
    writeFileSync(testPagePath, testPageOriginal);
    await withGuards(timedGet(`${baseUrl}/docs/test`));
    await withGuards(snapshot('afterHmr'));

    currentPhase = 'idle';
    await withGuards(new Promise((resolve) => setTimeout(resolve, idleSeconds * 1000)));
    await withGuards(snapshot('idleEnd'));
  } catch (error) {
    // 超限时停进程会让进行中的请求先失败，那个报错只是超限的后果，不另记；单次运行超时记成错误
    result.error = result.overLimit ? null : (limitError?.message ?? String(error.message ?? error));
  } finally {
    clearTimeout(runTimer);
    writeFileSync(testPagePath, testPageOriginal);
    killProcessTree(server.pid);
    stopSampler();
    log.end();
  }

  result.memory.peak = { workingSet: peak.workingSet, privateBytes: peak.privateBytes, phase: peak.phase };
  result.totalMs = performance.now() - startedAt;
  mkdirSync(join(resultsDir, 'series'), { recursive: true });
  result.seriesFile = `series/${runLabel}.json`;
  writeFileSync(join(resultsDir, result.seriesFile), JSON.stringify(memorySeries));
  return result;
}

const [siteKey, pageCountArg, runArg, idleArg = '60', cacheMode = 'cold'] = process.argv.slice(2);
if (!(siteKey in sites) || !Number.isInteger(Number(pageCountArg)) || !Number.isInteger(Number(runArg)) || !Number.isFinite(Number(idleArg)) || !cacheModes.includes(cacheMode)) {
  console.error(`用法：node bench.mjs <${Object.keys(sites).join('|')}> <生成页数> <第几次> [空闲秒数=60] [${cacheModes.join('|')}，默认 cold]`);
  process.exit(2);
}
const result = await runOnce(siteKey, Number(pageCountArg), Number(runArg), Number(idleArg), cacheMode);
mkdirSync(resultsDir, { recursive: true });
appendFileSync(join(resultsDir, 'raw.jsonl'), `${JSON.stringify(result)}\n`);
console.log(JSON.stringify(result, null, 2));
process.exit(0);
