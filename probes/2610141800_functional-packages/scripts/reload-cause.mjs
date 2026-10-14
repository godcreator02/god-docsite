// 查 dev 下「action 写站点目录里的数据文件 → 整页刷新、SSR 模块重载」的成因：
// 开 dev，浏览器打开 /docs 并打标记，改 data/demo-counter.json，看页面有没有整页刷新、服务端有没有 program reload。
// 用法：node scripts/reload-cause.mjs <记录名>（app.css 的写法由调用方事先改好）
import { writeFileSync } from 'node:fs';
import { chromium } from 'playwright';
import { assertPortFree, demoCounterFile, resetDemoCounterFile, startServer, useRunLogDir, reactRouterBin, waitForHttp } from './lib.mjs';

const label = process.argv[2];
if (!label) throw new Error('缺记录名：node scripts/reload-cause.mjs <记录名>');
const port = 5693;
useRunLogDir(`reload-cause-${label}`);
resetDemoCounterFile();
await assertPortFree(port);
const server = startServer({
  name: 'dev',
  args: [reactRouterBin, 'dev', '--port', String(port), '--host', '127.0.0.1', '--strictPort'],
  port,
  env: { DEBUG: 'vite:hmr' },
  logName: 'dev-server.txt',
});
try {
  await waitForHttp(`http://127.0.0.1:${port}/`, { timeoutMs: 120_000, server });
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage();
    await page.goto(`http://127.0.0.1:${port}/docs`, { waitUntil: 'networkidle' });
    await page.evaluate(() => {
      window.__probeNoReloadMarker = 'kept';
    });
    const before = server.output().length;
    writeFileSync(demoCounterFile, `${JSON.stringify({ count: 41, updatedAt: new Date().toISOString() }, null, 2)}\n`);
    await new Promise((resolve) => setTimeout(resolve, 5000));
    const marker = await page.evaluate(() => window.__probeNoReloadMarker).catch((error) => `页面不可用：${error.message}`);
    const after = server.output().slice(before);
    console.log(`[${label}] 改数据文件 5 秒后：页面标记=${marker}（kept 表示没整页刷新）`);
    console.log(`[${label}] 这段时间 dev 服务输出：\n${after.trim() || '（无）'}`);
  } finally {
    await browser.close();
  }
} finally {
  await server.stop();
  resetDemoCounterFile();
}
