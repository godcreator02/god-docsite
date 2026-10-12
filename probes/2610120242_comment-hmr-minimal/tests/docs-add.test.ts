import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { spawn } from 'node:child_process';
import { rm, writeFile } from 'node:fs/promises';
import path from 'node:path';

/**
 * 新增正文基线的 HTTP 层回归（index: { target: 'default' } 形态）：
 * 起 dev → SSR 已有正文 → 运行中新增一篇 MDX → 轮询直到可直接访问 → 清理。
 * 浏览器层的状态保留/客户端导航证据在 docs-add-result.md（真实浏览器实测）。
 * pnpm test 从 probe 根目录运行，cwd 即 probe 根。
 */
const probeRoot = process.cwd();
const siteDir = path.join(probeRoot, 'site-b');
const port = 5520;
const base = `http://127.0.0.1:${port}`;
const addedPage = path.join(siteDir, 'content', 'docs', 'vitest-page.mdx');

let dev: ReturnType<typeof spawn> | null = null;

async function get(url: string): Promise<{ status: number; text: string }> {
  try {
    const res = await fetch(url, { redirect: 'manual' });
    return { status: res.status, text: await res.text() };
  } catch {
    // dev 启动/重启窗口内连接拒绝按「暂不可用」处理，由 pollUntil 继续轮询
    return { status: 0, text: '' };
  }
}

async function pollUntil(
  check: () => Promise<boolean>,
  timeoutMs: number,
  what: string,
): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await check()) return;
    await new Promise((resolve) => setTimeout(resolve, 400));
  }
  throw new Error(`等待超时：${what}（${timeoutMs}ms）`);
}

beforeAll(async () => {
  // Vitest 沙箱的 PATH 里没有 cmd.exe（spawn npx 会 ENOENT），直接用 node 跑 CLI 入口
  const cli = path.join(siteDir, 'node_modules', '@react-router', 'dev', 'bin.cjs');
  dev = spawn(process.execPath, [cli, 'dev', '--port', String(port), '--host', '127.0.0.1'], {
    cwd: siteDir,
    stdio: 'ignore',
    detached: false,
  });
  await pollUntil(
    async () => (await get(`${base}/docs`)).status === 200,
    90_000,
    'dev 服务就绪',
  );
}, 150_000);

afterAll(async () => {
  await rm(addedPage, { force: true });
  if (dev?.pid) {
    if (process.platform === 'win32') {
      spawn('taskkill', ['/pid', String(dev.pid), '/T', '/F'], { shell: true, stdio: 'ignore' });
    } else {
      dev.kill('SIGTERM');
    }
  }
  await new Promise((resolve) => setTimeout(resolve, 1500));
});

describe('新增正文基线（default-target，HTTP 层）', () => {
  it('SSR 渲染已有正文、正文内交互组件与导航', async () => {
    const { status, text } = await get(`${base}/docs`);
    expect(status).toBe(200);
    expect(text).toContain('已有正文');
    expect(text).toContain('data-docs-counter');
    expect(text).toContain('data-nav-page="/docs"');
  });

  it('运行中新增 MDX 后，新 URL 在重新生成窗口后可直接访问', async () => {
    await writeFile(
      addedPage,
      `---\ntitle: Vitest 新增页\ndescription: 运行中新增\n---\n\n## Vitest 新增\n\n这一页由 Vitest 在服务运行中写入。\n`,
    );
    await pollUntil(
      async () => (await get(`${base}/docs/vitest-page`)).status === 200,
      30_000,
      '新增页可直达',
    );
    const { text } = await get(`${base}/docs/vitest-page`);
    expect(text).toContain('Vitest 新增');
  });
});
