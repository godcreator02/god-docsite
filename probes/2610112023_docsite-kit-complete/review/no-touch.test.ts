import { test, expect } from '../../../packages/docsite-kit/node_modules/vitest/dist/index.js';
import { createServer } from '../site/node_modules/vite/dist/node/index.js';
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

test('real validation site: create and delete without touching source.config.ts', async () => {
  const site = fileURLToPath(new URL('../site/', import.meta.url));
  const oldCwd = process.cwd();
  const oldCode = process.env.DOCSITE_IDENTITY_CODE;
  const oldOrigin = process.env.PROBE_SITE_ORIGIN;
  const people = JSON.parse(await readFile(path.join(site, 'people.json'), 'utf8'));
  process.env.DOCSITE_IDENTITY_CODE = people.find((p: any) => p.id === 'zk').codes[0];
  process.env.PROBE_SITE_ORIGIN = 'http://127.0.0.1:5462';
  process.chdir(site);
  let server: Awaited<ReturnType<typeof createServer>> | undefined;
  let thread: string | undefined;
  let patched = false;
  const events: unknown[] = [];
  const marker = 'main-no-touch-' + Date.now();
  const post = async (args: Record<string, string>) => {
    const body = new FormData();
    for (const [key, value] of Object.entries(args)) body.set(key, value);
    return fetch('http://127.0.0.1:5462/api/comments', { method: 'POST', body, headers: { Origin: 'http://127.0.0.1:5462' } });
  };
  try {
    server = await createServer({ root: site, configFile: path.join(site, 'vite.config.ts'), server: { port: 5462, host: '127.0.0.1', strictPort: true }, plugins: [{ name: 'diagnostic-no-config-touch', enforce: 'pre', transform(code, id) { if (process.env.DIAG_BASE_FIX === "1" && /[\\/]\.source[\\/](server|browser)\.ts$/.test(id.split("?")[0])) return code.replaceAll('"base": "./../comments"', '"base": "/comments"'); if (id.replaceAll('\\', '/').split('?')[0].endsWith('/app/routes/api-comments.ts')) { expect(code).toContain('if (response.ok) await refreshCollections();'); patched = true; return code.replace('if (response.ok) await refreshCollections();', '/* diagnostic: no config touch */'); } } }] });
    server.watcher.on('all', (event, file) => { if (file.includes('comments')) events.push({event,file}); });
    for (const plugin of server.config.plugins) { if (plugin.name === 'vite:import-glob' && typeof plugin.hotUpdate === 'function') { const original = plugin.hotUpdate; plugin.hotUpdate = async function(ctx: any) { const out = await original.call(this, ctx); if (ctx.file.includes('/comments/')) events.push({ hook: plugin.name, env: this.environment.name, type: ctx.type, file: ctx.file, before: ctx.modules.map((m: any) => m.id), after: out?.map((m: any) => m.id) }); return out; }; } }
    await server.listen();
    expect((await fetch('http://127.0.0.1:5462/comments')).status).toBe(200);
    const created = await post({ op: 'create', body: marker });
    expect(created.status).toBe(200);
    const result: any = await created.json();
    thread = result.thread;
    expect(patched).toBe(true);
    expect(typeof thread).toBe('string');
    console.log('DIAG created', thread, 'disk entries', (await readdir(path.join(site, 'comments'))).includes(thread!));
    await expect.poll(async () => (await (await fetch('http://127.0.0.1:5462/comments')).text()).includes(`${thread}/index.mdx`), { timeout: 6000, interval: 500 }).toBe(true);
    console.log('DIAG create SSR updated without touch');
    const deleted = await post({ op: 'delete', thread: thread!, file: 'index.mdx' });
    expect(deleted.status).toBe(200);
    await expect.poll(async () => { const r = await fetch('http://127.0.0.1:5462/comments'); return { status: r.status, contains: (await r.text()).includes(`${thread}/index.mdx`) }; }, { timeout: 6000, interval: 500 }).toEqual({ status: 200, contains: false });
    console.log('DIAG delete SSR updated without touch');
  } finally {
    if (thread && (await readdir(path.join(site, 'comments'))).includes(thread)) await post({ op: 'delete', thread, file: 'index.mdx' });
    console.log('DIAG file events', JSON.stringify(events));
    console.log('DIAG glob module ids', [...(server?.environments.ssr.moduleGraph.idToModuleMap.keys() ?? [])].filter(x => x.includes('.source/server')));
    await server?.close();
    process.chdir(oldCwd);
    if (oldCode === undefined) delete process.env.DOCSITE_IDENTITY_CODE; else process.env.DOCSITE_IDENTITY_CODE = oldCode;
    if (oldOrigin === undefined) delete process.env.PROBE_SITE_ORIGIN; else process.env.PROBE_SITE_ORIGIN = oldOrigin;
  }
});




