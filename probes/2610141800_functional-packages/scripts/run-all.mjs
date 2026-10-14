// 全部验证：两种装法 × 两种集合写法 × dev 与 build+start，外加类型生成、.server 检查、不挂 vite 插件的对照、全局插件对照。
// 用法：node scripts/run-all.mjs [--install=linked,packed] [--collections=config,macro,macro-lazy-options] [--server=dev,start]
//       [--extras=typegen,dot-server,reexport-loader,no-plugin,global-only,prerender-feature-page] [--keep-install-mode]
import { copyFileSync, existsSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { runBrowserChecks } from './browser-checks.mjs';
import {
  assertPortFree,
  assertSiteInstalled,
  demoCounterFile,
  logPath,
  probeDir,
  reactRouterBin,
  reactRouterServeBin,
  resetDemoCounterFile,
  runLogged,
  siteDir,
  startServer,
  useRunLogDir,
  waitForHttp,
} from './lib.mjs';
import { applyCollectionsVariant, applyInstallMode, buildFeaturePackages, describeInstalledFeaturePackages } from './setup.mjs';

const devPort = 5691;
const startPort = 5692;
const serverReadyTimeoutMs = 120_000;
const buildTimeoutMs = 600_000;
const recommendedCollections = 'config';

function parseList(flag, fallback) {
  const argument = process.argv.find((value) => value.startsWith(`--${flag}=`));
  return argument ? argument.slice(flag.length + 3).split(',').filter(Boolean) : fallback;
}

const installModes = parseList('install', ['linked', 'packed']);
const collectionsVariants = parseList('collections', ['config', 'macro', 'macro-lazy-options']);
const serverModes = parseList('server', ['dev', 'start']);
const extras = parseList('extras', ['typegen', 'dot-server', 'reexport-loader', 'no-plugin', 'global-only', 'prerender-feature-page']);
const keepInstallMode = process.argv.includes('--keep-install-mode');

const runName = new Date().toISOString().replace(/[-:]/g, '').replace('T', '-').slice(0, 13);
const runDir = useRunLogDir(runName);
const report = { runName, startedAt: new Date().toISOString(), node: process.version, sections: [] };
const liveServers = new Set();

function section(title, entries) {
  report.sections.push({ title, entries });
  const lines = [`\n=== ${title}`, ...entries.map((entry) => (typeof entry === 'string' ? `  ${entry}` : `  [${entry.pass ? '通过' : '失败'}] ${entry.name}：${entry.detail}`))];
  console.log(lines.join('\n'));
}

async function withServer(options, body) {
  await assertPortFree(options.port);
  const server = startServer(options);
  liveServers.add(server);
  try {
    await waitForHttp(`http://127.0.0.1:${options.port}/`, { timeoutMs: serverReadyTimeoutMs, server });
    return await body(server);
  } finally {
    await server.stop();
    liveServers.delete(server);
  }
}

function devServerOptions(label, env = {}) {
  return {
    name: `dev ${label}`,
    args: [reactRouterBin, 'dev', '--port', String(devPort), '--host', '127.0.0.1', '--strictPort'],
    port: devPort,
    env: { PROBE_PRINT_FEATURE_PACKAGES: '1', ...env },
    logName: `${label}-dev-server.txt`,
  };
}

function startServerOptions(label) {
  return {
    name: `start ${label}`,
    args: [reactRouterServeBin, './build/server/index.js'],
    port: startPort,
    env: { PORT: String(startPort), HOST: '127.0.0.1', NODE_ENV: 'production' },
    logName: `${label}-start-server.txt`,
  };
}

function buildSite(label, env = {}) {
  rmSync(path.join(siteDir, 'build'), { recursive: true, force: true });
  return runLogged(process.execPath, [reactRouterBin, 'build'], {
    cwd: siteDir,
    env: { PROBE_PRINT_FEATURE_PACKAGES: '1', ...env },
    logName: `${label}-build.txt`,
    timeoutMs: buildTimeoutMs,
  });
}

function listFilesRecursive(dir) {
  return readdirSync(dir).flatMap((name) => {
    const full = path.join(dir, name);
    return statSync(full).isDirectory() ? listFilesRecursive(full) : [full];
  });
}

const clientLeakPatterns = {
  'node:fs': '服务端的 node:fs',
  '__vite-browser-external': '被 Vite 换成浏览器空壳的 Node 内置模块',
  'demo-pages-server-only-marker': 'demo.server.ts 里的标记字符串',
  'demo-counter.json': '数据文件名（只在 node/ 层出现）',
  inlineMath: 'remark-math 的代码（构建期插件进了浏览器）',
  'mdx-export': 'fumadocs-mdx/config 的 applyMdxPreset 代码',
};

function scanClientBuild() {
  const clientDir = path.join(siteDir, 'build', 'client');
  const scripts = listFilesRecursive(clientDir).filter((file) => file.endsWith('.js'));
  const totalBytes = scripts.reduce((sum, file) => sum + statSync(file).size, 0);
  const hits = Object.fromEntries(
    Object.keys(clientLeakPatterns).map((pattern) => [
      pattern,
      scripts.filter((file) => readFileSync(file, 'utf8').includes(pattern)).map((file) => path.relative(clientDir, file).replaceAll('\\', '/')),
    ]),
  );
  return { scriptCount: scripts.length, totalBytes, hits };
}

function clientScanEntries(scan) {
  const serverLeaks = ['node:fs', 'demo-pages-server-only-marker', 'demo-counter.json'].filter((pattern) => scan.hits[pattern].length > 0);
  return [
    {
      name: '4-no-server-code-in-client',
      pass: serverLeaks.length === 0,
      detail: serverLeaks.length === 0 ? `build/client 的 ${scan.scriptCount} 个 js 里没有 node:fs、服务端标记、数据文件名` : `漏进客户端：${serverLeaks.map((p) => `${p} → ${scan.hits[p].join(', ')}`).join('；')}`,
    },
    `build/client：${scan.scriptCount} 个 js，共 ${(scan.totalBytes / 1024).toFixed(1)} KB`,
    ...Object.entries(scan.hits).map(([pattern, files]) => `搜「${pattern}」（${clientLeakPatterns[pattern]}）：${files.length === 0 ? '无' : files.join(', ')}`),
  ];
}

// 服务端渲染时 fumadocs 有两份实例，报错只出现在服务日志里（页面是 500）
function serverFrameworkProviderEntry(serverOutput) {
  const count = serverOutput.split('\n').filter((line) => line.includes('You need to wrap your application inside `FrameworkProvider`')).length;
  return { name: '5-single-fumadocs-instance-ssr', pass: count === 0, detail: `服务日志里 FrameworkProvider 报错 ${count} 行` };
}

async function devBrowserRun(label, env) {
  resetDemoCounterFile();
  return withServer(devServerOptions(label, env), async (server) => {
    const { results } = await runBrowserChecks(`http://127.0.0.1:${devPort}`);
    results.push(serverFrameworkProviderEntry(server.output()));
    const crawlLine = server.output().split('\n').find((line) => line.includes('[feature-packages]'));
    return { results, crawlLine };
  });
}

async function startBrowserRun(label, env, { counterAtBuild = 0 } = {}) {
  writeFileSync(demoCounterFile, `${JSON.stringify({ count: counterAtBuild, updatedAt: null }, null, 2)}\n`);
  const build = buildSite(label, env);
  if (build.status !== 0) {
    return { buildFailed: true, results: [{ name: 'build', pass: false, detail: `构建失败（exit ${build.status}${build.timedOut ? '，超时' : ''}），见 ${path.relative(probeDir, build.logFile)}` }] };
  }
  const scan = scanClientBuild();
  resetDemoCounterFile();
  const { results } = await withServer(startServerOptions(label), async (server) => {
    const checks = await runBrowserChecks(`http://127.0.0.1:${startPort}`);
    checks.results.push(serverFrameworkProviderEntry(`${build.output}\n${server.output()}`));
    return checks;
  });
  const crawlLine = build.output.split('\n').find((line) => line.includes('[feature-packages]'));
  return { results, scan, crawlLine };
}

async function runMatrixCell(installMode, collections, serverMode) {
  const label = `${installMode}-${collections}-${serverMode}`;
  applyCollectionsVariant(collections);
  const outcome = serverMode === 'dev' ? await devBrowserRun(label, {}) : await startBrowserRun(label, {});
  const comparisonPrefix = collections === recommendedCollections ? '' : `对照（${collections}）`;
  const entries = outcome.results.map((entry) => ({ ...entry, name: `${comparisonPrefix}${entry.name}` }));
  if (outcome.scan) entries.push(...clientScanEntries(outcome.scan));
  if (outcome.crawlLine) entries.push(`vite 插件识别结果：${outcome.crawlLine.trim()}`);
  section(`${label}`, entries);
}

function typegenCheck(installMode) {
  const label = `${installMode}-${recommendedCollections}-typegen`;
  applyCollectionsVariant(recommendedCollections);
  // 先 build 一次让 fumadocs-mdx 生成 .source/（tsc 要用它的类型）
  rmSync(path.join(siteDir, '.react-router'), { recursive: true, force: true });
  const build = buildSite(`${label}-prebuild`);
  const typegen = runLogged(process.execPath, [reactRouterBin, 'typegen'], { cwd: siteDir, logName: `${label}-typegen.txt`, timeoutMs: 120_000 });
  const typesFile = path.join(siteDir, '.react-router', 'types', 'app', 'features', 'demo', '+types', 'demo.ts');
  const tsc = runLogged(process.execPath, [path.join(siteDir, 'node_modules', 'typescript', 'bin', 'tsc'), '--noEmit', '-p', 'tsconfig.json'], {
    cwd: siteDir,
    logName: `${label}-tsc.txt`,
    timeoutMs: 300_000,
  });
  section(label, [
    { name: '4-typegen-forwarding-file', pass: build.status === 0 && typegen.status === 0 && existsSync(typesFile), detail: `typegen exit ${typegen.status}；${path.relative(siteDir, typesFile)} ${existsSync(typesFile) ? '已生成' : '不存在'}` },
    { name: '4-tsc', pass: tsc.status === 0, detail: tsc.status === 0 ? 'tsc --noEmit 通过（转发文件用 Route.LoaderArgs / Route.ActionArgs）' : `tsc 失败，见 ${path.relative(probeDir, tsc.logFile)}：${tsc.output.split('\n').filter((line) => line.includes('error')).slice(0, 5).join(' | ')}` },
  ]);
}

const forwardingFile = path.join(siteDir, 'app', 'features', 'demo', 'demo.tsx');
const badForwardingFile = `import type { Route } from './+types/demo';
import { demoAction, demoLoader } from 'demo-pages/site/server';
import { site } from '@/lib/site.server';

export const loader = (args: Route.LoaderArgs) => demoLoader(args, site);
export const action = (args: Route.ActionArgs) => demoAction(args, site);

// 故意违规：页面组件（客户端代码）用到了 .server 模块里的东西
export default function BadDemoPage() {
  return <p data-bad-demo="">{demoLoader.name}</p>;
}
`;

async function devDotServerProbe(label, env) {
  return withServer(devServerOptions(label, env), async (server) => {
    const { chromium } = await import('playwright');
    const browser = await chromium.launch({ headless: true });
    try {
      const page = await browser.newPage();
      const consoleLines = [];
      const failedRouteModuleRequests = [];
      const serverModuleRequests = [];
      page.on('console', (message) => consoleLines.push(message.text()));
      page.on('request', (request) => {
        if (request.url().includes('demo.server')) serverModuleRequests.push(request.url().replace(/^.*node_modules/, '…node_modules'));
      });
      page.on('response', (response) => {
        if (response.status() >= 500 && response.url().includes('/app/features/demo/demo.tsx')) failedRouteModuleRequests.push(`${response.status()} ${new URL(response.url()).pathname}`);
      });
      await page.goto(`http://127.0.0.1:${devPort}/docs`, { waitUntil: 'load' });
      await page.locator('aside a[href="/demo"]').first().click();
      // 客户端编译这个路由模块被拒时，React Router 退回整页请求，由服务端渲染出页面；没被拒时浏览器直接执行它
      await page.waitForSelector('[data-bad-demo]', { timeout: 30_000 });
      const output = server.output();
      const serverSaid = output.includes('Server-only module referenced by client') && output.includes(`'app/features/demo/demo.tsx'`);
      const reloadNotice = consoleLines.find((text) => text.includes('Error loading route module')) ?? '（无）';
      return {
        blocked: serverSaid && failedRouteModuleRequests.length > 0 && serverModuleRequests.length === 0,
        detail: `站内导航时：dev 服务报 Server-only module referenced by client=${serverSaid}；路由模块请求 ${failedRouteModuleRequests.join(', ') || '无 5xx'}；浏览器请求的 .server 模块：${serverModuleRequests.join(', ') || '无'}；控制台：${reloadNotice}`,
      };
    } finally {
      await browser.close();
    }
  });
}

async function dotServerCheck(installMode) {
  const label = `${installMode}-${recommendedCollections}-dot-server`;
  applyCollectionsVariant(recommendedCollections);
  const original = readFileSync(forwardingFile, 'utf8');
  writeFileSync(forwardingFile, badForwardingFile);
  try {
    const build = buildSite(`${label}`);
    const buildBlocked = build.status !== 0 && build.output.includes('Server-only module referenced by client');
    const withGuard = await devDotServerProbe(`${label}-guard`, {});
    const withoutGuard = await devDotServerProbe(`${label}-no-guard`, { PROBE_DISABLE_DEV_DOT_SERVER_GUARD: '1' });
    section(label, [
      { name: '4-dot-server-build', pass: buildBlocked, detail: `页面组件引用 .server 模块时 build ${build.status === 0 ? '竟然通过' : '失败'}${buildBlocked ? '，报 Server-only module referenced by client' : ''}（${path.relative(probeDir, build.logFile)}）` },
      { name: '4-dot-server-dev', pass: withGuard.blocked, detail: withGuard.detail },
      { name: '对照（关掉站点插件里的 dev 补查）4-dot-server-dev', pass: withoutGuard.blocked, detail: withoutGuard.detail },
    ]);
  } finally {
    writeFileSync(forwardingFile, original);
  }
}
// 不带站点参数的功能包 loader 能不能在页面路由里直接 re-export：React Router 要能把 re-export 的 loader 从客户端代码里剥掉
const reexportForwardingFile = `export { demoEventsLoader as loader } from 'demo-pages/site/server';
export { DemoPage as default } from 'demo-pages/site';
`;

function reexportLoaderCheck(installMode) {
  const label = `${installMode}-${recommendedCollections}-reexport-loader`;
  applyCollectionsVariant(recommendedCollections);
  const original = readFileSync(forwardingFile, 'utf8');
  writeFileSync(forwardingFile, reexportForwardingFile);
  try {
    const build = buildSite(label);
    const scan = build.status === 0 ? scanClientBuild() : null;
    const leaked = scan ? ['node:fs', 'demo-pages-server-only-marker', 'demo-counter.json'].filter((pattern) => scan.hits[pattern].length > 0) : [];
    section(label, [
      {
        name: '4-reexport-loader-in-page-route',
        pass: build.status === 0 && leaked.length === 0,
        detail: `页面路由写 export { x as loader } from '…/site/server'：build exit ${build.status}；客户端产物里的服务端代码：${leaked.join(', ') || '无'}（${path.relative(probeDir, build.logFile)}）`,
      },
    ]);
  } finally {
    writeFileSync(forwardingFile, original);
  }
}

async function noPluginBaseline(installMode) {
  const env = { PROBE_DISABLE_FEATURE_PACKAGES_PLUGIN: '1' };
  applyCollectionsVariant(recommendedCollections);
  for (const serverMode of serverModes) {
    const label = `${installMode}-${recommendedCollections}-no-plugin-${serverMode}`;
    const outcome = serverMode === 'dev' ? await devBrowserRun(label, env) : await startBrowserRun(label, env);
    const entries = outcome.results.map((entry) => ({ ...entry, name: `对照（不挂 vite 插件）${entry.name}` }));
    if (outcome.scan) entries.push(...clientScanEntries(outcome.scan));
    section(label, entries);
  }
}

async function globalOnlyCheck(installMode) {
  for (const variant of ['macro-global-only', 'config-global-only']) {
    const label = `${installMode}-${variant}-dev`;
    applyCollectionsVariant(variant);
    const html = await withServer(devServerOptions(label), async () => (await fetch(`http://127.0.0.1:${devPort}/docs`)).text());
    writeFileSync(logPath(`${label}-docs.html`), html);
    section(label, [
      `集合只挂功能包插件、公式插件只挂全局：remark 插件生效=${html.includes('data-demo-remark="applied"')}；公式渲染（含 class="katex"）=${html.includes('class="katex"')}；原样 $E = mc^2$ 留在正文=${html.includes('$E = mc^2$')}`,
    ]);
  }
}

async function prerenderFeaturePageCheck(installMode) {
  const label = `${installMode}-${recommendedCollections}-prerender-feature-page-start`;
  applyCollectionsVariant(recommendedCollections);
  // 构建时文件里是 7、启动前重置成 0：页面显示 7 就是预渲染进去的旧数据
  const outcome = await startBrowserRun(label, { PROBE_PRERENDER_FEATURE_PAGE: '1' }, { counterAtBuild: 7 });
  section(label, outcome.results.map((entry) => ({ ...entry, name: `对照（/demo 也预渲染，构建时文件 count=7）${entry.name}` })));
}

// 一格崩了（服务起不来、构建超时）记成失败项，接着跑后面的格
async function recordCrash(label, body) {
  try {
    await body();
  } catch (error) {
    section(label, [{ name: 'crashed', pass: false, detail: error.message.split('\n')[0] }]);
  }
}

async function main() {
  assertSiteInstalled();
  section('环境', [`运行 ${runName}，日志目录 ${path.relative(probeDir, runDir)}`, `Node ${process.version}`]);
  buildFeaturePackages('build-packages.txt');
  try {
    for (const installMode of installModes) {
      const installed = applyInstallMode(installMode, installMode);
      section(`装法 ${installMode}`, installed);
      // 推荐写法每种装法都跑；对照写法只在第一种装法下跑
      const collectionsForThisMode = installMode === installModes[0] ? collectionsVariants : collectionsVariants.filter((name) => name === recommendedCollections);
      for (const collections of collectionsForThisMode) {
        for (const serverMode of serverModes) await recordCrash(`${installMode}-${collections}-${serverMode}`, () => runMatrixCell(installMode, collections, serverMode));
      }
      if (extras.includes('typegen')) await recordCrash(`${installMode}-typegen`, () => typegenCheck(installMode));
      if (extras.includes('dot-server')) await recordCrash(`${installMode}-dot-server`, () => dotServerCheck(installMode));
      if (extras.includes('reexport-loader')) await recordCrash(`${installMode}-reexport-loader`, () => reexportLoaderCheck(installMode));
      if (extras.includes('no-plugin')) await recordCrash(`${installMode}-no-plugin`, () => noPluginBaseline(installMode));
      if (extras.includes('global-only') && installMode === installModes[0]) await recordCrash(`${installMode}-global-only`, () => globalOnlyCheck(installMode));
      if (extras.includes('prerender-feature-page') && installMode === installModes[0]) await recordCrash(`${installMode}-prerender-feature-page`, () => prerenderFeaturePageCheck(installMode));
    }
  } finally {
    applyCollectionsVariant(recommendedCollections);
    if (!keepInstallMode && installModes.at(-1) !== 'linked') applyInstallMode('linked', 'restore-linked');
    resetDemoCounterFile();
    report.finishedAt = new Date().toISOString();
    writeFileSync(path.join(runDir, 'report.json'), `${JSON.stringify(report, null, 2)}\n`);
  }
  const failures = report.sections.flatMap((s) => s.entries.filter((e) => typeof e === 'object' && !e.pass && !e.name.startsWith('对照')).map((e) => `${s.title} / ${e.name}`));
  console.log(`\n共 ${failures.length} 项失败（不含对照组）${failures.length ? '：\n  ' + failures.join('\n  ') : ''}`);
  console.log(`报告：${path.relative(probeDir, path.join(runDir, 'report.json'))}`);
  process.exitCode = failures.length === 0 ? 0 : 1;
}

process.on('SIGINT', async () => {
  for (const server of liveServers) await server.stop();
  process.exit(130);
});

await main();
