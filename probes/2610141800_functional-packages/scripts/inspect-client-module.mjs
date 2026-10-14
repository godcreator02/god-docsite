// 开 dev，取某个模块经 Vite 客户端编译后的代码，看它的 import 被改写成了什么地址。
// 用法：node scripts/inspect-client-module.mjs <记录名> <模块地址，如 /app/features/demo/demo.tsx>
import { writeFileSync } from 'node:fs';
import { assertPortFree, logPath, reactRouterBin, startServer, useRunLogDir, waitForHttp } from './lib.mjs';

const [label, modulePath] = process.argv.slice(2);
if (!label || !modulePath) throw new Error('用法：node scripts/inspect-client-module.mjs <记录名> <模块地址>');
const port = 5694;
useRunLogDir(`inspect-${label}`);
await assertPortFree(port);
const server = startServer({
  name: 'dev',
  args: [reactRouterBin, 'dev', '--port', String(port), '--host', '127.0.0.1', '--strictPort'],
  port,
  env: {},
  logName: 'dev-server.txt',
});
try {
  await waitForHttp(`http://127.0.0.1:${port}/`, { timeoutMs: 120_000, server });
  const response = await fetch(`http://127.0.0.1:${port}${modulePath}`);
  const code = await response.text();
  writeFileSync(logPath('module.txt'), `GET ${modulePath} → ${response.status}\n\n${code}`);
  console.log(`GET ${modulePath} → ${response.status}`);
  for (const line of code.split('\n').filter((line) => line.startsWith('import '))) console.log(line.slice(0, 300));
} finally {
  await server.stop();
}
