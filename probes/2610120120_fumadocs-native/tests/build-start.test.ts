import { execSync } from 'node:child_process';
import { existsSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  LOGS_DIR,
  SITE_DIR,
  SEED_THREAD,
  START_BASE,
  cleanupStrayThreads,
  getPageEventually,
  getDocs,
  postAction,
  spawnServer,
  waitFor,
  type ServerHandle,
} from './helpers';

let server: ServerHandle;

beforeAll(async () => {
  cleanupStrayThreads();
  // build 集中做一次：输出整份写进日志，失败时把日志尾部带进报错
  try {
    const output = execSync('pnpm exec react-router build', {
      cwd: SITE_DIR,
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true,
      encoding: 'utf-8',
    });
    writeFileSync(path.join(LOGS_DIR, 'build.log'), output, 'utf-8');
  } catch (error) {
    const detail = error instanceof Error && 'stdout' in error ? `${(error as any).stdout}\n${(error as any).stderr}` : String(error);
    writeFileSync(path.join(LOGS_DIR, 'build.log'), detail, 'utf-8');
    throw new Error(`react-router build 失败（全文见 tests/logs/build.log）：\n${detail.split('\n').slice(-20).join('\n')}`);
  }
  if (!existsSync(path.join(SITE_DIR, 'build', 'server', 'index.js'))) {
    throw new Error('build 产物缺失：build/server/index.js 不存在');
  }
  server = spawnServer('start-snapshot', 'pnpm', ['exec', 'react-router-serve', './build/server/index.js'], {
    // react-router-serve 只认 PORT/HOST 环境变量，不吃 --port 参数
    PORT: '5471',
    HOST: '127.0.0.1',
  });
  await waitFor(() => getDocs(START_BASE).then(() => 'up'), { what: 'start 快照服务就绪', timeoutMs: 60_000 });
}, 300_000);

afterAll(async () => {
  await server?.stop();
  cleanupStrayThreads();
});

describe('build/start：只读快照（评论与正文同一时刻编译）', () => {
  it('SSR 快照里有正文与样例评论（含 TSX 组件与图片）', async () => {
    const html = await getPageEventually(START_BASE);
    expect(html).toContain('第一页');
    expect(html).toContain('样例评论串：这一条带同目录的交互组件和图片');
    expect(html).toContain('data-comment-counter');
    expect(html).toContain('回复：同目录图片与组件都能显示的话');
    // build 会把小图内联成 data URI（Vite 默认 4KB 阈值），dev 才是 /comments/ 路径
    const img = html.match(/<img[^>]*alt="绿点"[^>]*>/)?.[0] ?? '';
    expect(img).toMatch(/src="(data:image\/png;base64,|\/comments\/20261012t080000-seed1\/dot\.png)/);
  });

  it('快照里的图片可用（URL 形式则取回 200，内联形式则已在页面里）', async () => {
    const html = await getPageEventually(START_BASE);
    const src = html.match(/<img[^>]*alt="绿点"[^>]*src="([^"]+)"/)?.[1] ?? '';
    expect(src.length).toBeGreaterThan(0);
    if (!src.startsWith('data:')) {
      const res = await fetch(new URL(src, START_BASE));
      expect(res.status).toBe(200);
      expect(res.headers.get('content-type')).toContain('image/png');
    }
  });

  it('启动没有身份码：界面只读、写接口拒绝', async () => {
    const html = await getPageEventually(START_BASE);
    expect(html).not.toContain('data-new-thread-form');
    expect(html).toContain('data-readonly-reason="no-identity"');
    const res = await postAction(START_BASE, { intent: 'create-thread', page: 'index.mdx', body: '快照不应可写' });
    expect(res.status).toBe(403);
    const html2 = await getPageEventually(START_BASE);
    expect(html2).not.toContain('快照不应可写');
  });

  it('首页可取', async () => {
    const res = await fetch(`${START_BASE}/`);
    expect(res.status).toBe(200);
  });

  it('未知页面 404', async () => {
    const res = await fetch(`${START_BASE}/docs/nope`);
    expect(res.status).toBe(404);
  });
});
