import { mkdirSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
const root = fileURLToPath(new URL('.', import.meta.url));
const siteDir = root + 'site';
process.chdir(siteDir);
const require = createRequire(siteDir + '/package.json');
const { createServer } = await import(pathToFileURL(require.resolve('vite')).href);
const server = await createServer({ root: siteDir, server: { middlewareMode: true, hmr: false }, appType: 'custom', logLevel: 'error' });
const started = Date.now();
try {
  const entry = await server.ssrLoadModule('/app/lib/e8-entry.ts');
  const { source } = await server.ssrLoadModule('/app/lib/source.ts');
  mkdirSync(root + 'out/baseline', { recursive: true });
  const results = [];
  for (const page of source.getPages()) {
    const name = page.path.replace(/^\//, '').replace(/[\\/]/g, '__') + '.md';
    if (!existsSync(root + '../2610111754_fumadocs-16-17-1/out/e8/' + name)) continue;
    const text = await entry.renderPageMarkdown(page.path);
    writeFileSync(root + 'out/baseline/' + name, text);
    const old = readFileSync(root + '../2610111754_fumadocs-16-17-1/out/e8/' + name, 'utf8');
    results.push({ path: page.path, bytes: Buffer.byteLength(text), identical: text === old });
  }
  const report = { count: results.length, identical: results.filter(x => x.identical).length, elapsedMs: Date.now() - started, results };
  writeFileSync(root + 'out/baseline-report.json', JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report));
} finally { await server.close(); }
