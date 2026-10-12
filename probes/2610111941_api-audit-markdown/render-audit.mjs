import { mkdirSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
const root = fileURLToPath(new URL('.', import.meta.url));
const siteDir = root + 'site';
process.chdir(siteDir);
const require = createRequire(siteDir + '/package.json');
const { createServer } = await import(pathToFileURL(require.resolve('vite')).href);
const server = await createServer({ root: siteDir, server: { middlewareMode: true, hmr: false }, appType: 'custom', logLevel: 'error' });
const paths = process.argv.slice(2);
try {
  const { renderAudit } = await server.ssrLoadModule('/app/lib/audit-entry.tsx');
  mkdirSync(root + 'out/audit', { recursive: true });
  const results = [];
  for (const path of paths) {
    try {
      const result = await renderAudit(path);
      const detected = [...new Set([...result.text.matchAll(/^[\t ]*<\/?([A-Z][\w$]*)/gm)].map(m => m[1]))];
      writeFileSync(root + 'out/audit/' + path.replaceAll('/', '__') + '.md', result.text);
      results.push({ path, detected, ...result });
    } catch(error) { results.push({ path, error: String(error) }); }
  }
  writeFileSync(root + 'out/audit-report.json', JSON.stringify(results, null, 2));
  console.log(JSON.stringify(results, null, 2));
} finally { await server.close(); }
