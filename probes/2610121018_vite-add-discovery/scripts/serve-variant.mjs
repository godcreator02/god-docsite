// 真实 http dev server，供浏览器验证用：
//   node scripts/serve-variant.mjs <variant-id> <port>
// 诊断事件每秒 dump 到 logs/serve-events-<variant-id>.json。
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';
import { diagnosticsPlugin } from '../diag/diagnostics.mjs';

const probeRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const [, , variantId, portArg] = process.argv;
if (!variantId || !portArg) {
  console.error('用法：node scripts/serve-variant.mjs <variant-id> <port>');
  process.exit(1);
}
const port = Number(portArg);
const root = path.join(probeRoot, 'cases', variantId);
const events = [];
const dumpPath = path.join(probeRoot, 'logs', `serve-events-${variantId}.json`);

const timer = setInterval(() => {
  fs.writeFile(dumpPath, JSON.stringify({ variant: variantId, port, events }, null, 2)).catch(() => {});
}, 1000);

const server = await createServer({
  root,
  configFile: false,
  plugins: [diagnosticsPlugin(events, { enforce: 'pre' }), diagnosticsPlugin(events, { enforce: 'post' })],
  server: { port, strictPort: true, host: '127.0.0.1' },
});
await server.listen();
console.log(`variant ${variantId} listening on http://127.0.0.1:${port}（Ctrl+C 停止）`);

async function shutdown() {
  clearInterval(timer);
  await fs.writeFile(dumpPath, JSON.stringify({ variant: variantId, port, events }, null, 2));
  await server.close();
  process.exit(0);
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
