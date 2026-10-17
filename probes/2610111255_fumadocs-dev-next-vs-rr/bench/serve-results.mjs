// 在 127.0.0.1 上只读提供 results/ 目录，方便在浏览器里看 report.html；到点自动退出。
// 用法：node serve-results.mjs [端口=4199] [分钟=30]
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { dirname, extname, join, normalize, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const resultsDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'results');
const [portArg = '4199', minutesArg = '30'] = process.argv.slice(2);
const contentTypes = { '.html': 'text/html; charset=utf-8', '.json': 'application/json', '.md': 'text/markdown; charset=utf-8', '.log': 'text/plain; charset=utf-8' };

const server = createServer(async (request, response) => {
  const requestPath = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
  const filePath = normalize(join(resultsDir, requestPath === '/' ? 'report.html' : requestPath));
  if (!filePath.startsWith(resultsDir + sep)) {
    response.writeHead(403).end();
    return;
  }
  try {
    const body = await readFile(filePath);
    response.writeHead(200, { 'content-type': contentTypes[extname(filePath)] ?? 'application/octet-stream', 'cache-control': 'no-store' }).end(body);
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
    response.writeHead(404).end();
  }
});
server.listen(Number(portArg), '127.0.0.1', () => console.log(`http://127.0.0.1:${portArg}/`));
setTimeout(() => process.exit(0), Number(minutesArg) * 60_000);
