import { spawn } from 'node:child_process';
import { execSync } from 'node:child_process';
import { existsSync, openSync, closeSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const PROBE_ROOT = fileURLToPath(new URL('..', import.meta.url));
export const SITE_DIR = path.join(PROBE_ROOT, 'site');
export const COMMENTS_DIR = path.join(SITE_DIR, 'comments');
export const LOGS_DIR = path.join(PROBE_ROOT, 'tests', 'logs');
export const SEED_THREAD = '20261012t080000-seed1';
export const DEV_BASE = 'http://127.0.0.1:5470';
export const START_BASE = 'http://127.0.0.1:5471';

const THREAD_ID = /^\d{8}t\d{6}-[0-9a-z]{2,8}$/;

export interface ServerHandle {
  pid: number;
  log: string;
  stop(): Promise<void>;
}

/** 起一个服务进程（日志整份写进 tests/logs/<name>.log），停的时候连树一起杀 */
export function spawnServer(
  name: string,
  command: string,
  args: string[],
  env: Record<string, string | undefined> = {},
): ServerHandle {
  const log = path.join(LOGS_DIR, `${name}.log`);
  const out = openSync(log, 'w');
  const child = spawn(command, args, {
    cwd: SITE_DIR,
    env: { ...process.env, ...cleanEnv(env) },
    shell: true,
    stdio: ['ignore', out, out],
  });
  const pid = child.pid ?? 0;
  if (pid === 0) throw new Error(`spawn 失败：${command} ${args.join(' ')}`);
  return {
    pid,
    log,
    async stop() {
      if (process.platform === 'win32') {
        execSync(`taskkill /PID ${pid} /T /F`, { stdio: 'ignore' });
      } else {
        child.kill('SIGTERM');
      }
      closeSync(out);
      await waitFor(async () => {
        try {
          const res = await fetch(portOf(name));
          return undefined;
        } catch {
          return 'down';
        }
      }, { timeoutMs: 15_000, intervalMs: 500, what: `${name} 退出` });
    },
  };
}

function cleanEnv(env: Record<string, string | undefined>): Record<string, string> {
  const result: Record<string, string> = {};
  for (const [k, v] of Object.entries(env)) {
    if (v !== undefined) result[k] = v;
    else if (k in process.env) result[k] = '';
  }
  return result;
}

function portOf(name: string): string {
  if (name.includes('start')) return START_BASE;
  return DEV_BASE;
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function waitFor<T>(
  check: () => Promise<T | undefined>,
  { timeoutMs = 60_000, intervalMs = 500, what }: { timeoutMs?: number; intervalMs?: number; what: string },
): Promise<T> {
  const start = Date.now();
  let last = '(no attempt)';
  while (Date.now() - start < timeoutMs) {
    try {
      const value = await check();
      if (value !== undefined) return value;
    } catch (error) {
      last = error instanceof Error ? error.message : String(error);
    }
    await sleep(intervalMs);
  }
  throw new Error(`waitFor 超时：${what}（${timeoutMs}ms）最后一次：${last}`);
}

export async function getDocs(base: string): Promise<string> {
  const res = await fetch(`${base}/docs`);
  if (!res.ok) throw new Error(`GET /docs -> ${res.status}`);
  return res.text();
}

/** dev 下集合入口重新生成会让 SSR 短暂 500（reload 窗口），取页时带重试 */
export async function getPageEventually(base: string, timeoutMs = 30_000): Promise<string> {
  return waitFor(() => getDocs(base), { timeoutMs, intervalMs: 500, what: 'SSR 恢复可用' });
}

/** 等 SSR 页面出现（contains=true）或不再包含（contains=false）一段文字 */
export async function waitPageContains(
  base: string,
  text: string,
  contains: boolean,
  what: string,
  timeoutMs = 30_000,
): Promise<void> {
  await waitFor(
    async () => {
      const html = await getDocs(base);
      return html.includes(text) === contains ? 'ok' : undefined;
    },
    { timeoutMs, intervalMs: 500, what },
  );
}

/**
 * 文档式 POST 到 /docs 的 action（浏览器外的表单提交同样走这条路）。
 * 单提款（/docs.data + turbo-stream）是浏览器内部的编码，测试直接用文档 POST：
 * action 的 data() 状态码会随文档响应传播，写入结果按 M1 从文件与 SSR 两头核对。
 */
export async function postAction(
  base: string,
  fields: Record<string, string>,
  { origin = new URL(base).origin }: { origin?: string | null } = {},
): Promise<{ status: number; text: string }> {
  const form = new FormData();
  for (const [key, value] of Object.entries(fields)) form.append(key, value);
  const headers: Record<string, string> = {};
  if (origin !== null) headers.origin = origin;
  const res = await fetch(`${base}/docs`, { method: 'POST', headers, body: form });
  return { status: res.status, text: await res.text() };
}

/** 等评论目录里出现一个新串文件夹，返回它的 id（M1：写就是改文件） */
export async function waitNewThreadDir(what: string, timeoutMs = 30_000): Promise<string> {
  return waitFor(
    () => {
      const strays = strayThreadDirs();
      return strays.length > 0 ? (strays.sort()[strays.length - 1] as string) : undefined;
    },
    { timeoutMs, intervalMs: 300, what },
  );
}

/** 等某串文件夹里出现指定后缀之外的新 mdx 文件（排除已知的），返回回复 id */
export async function waitNewReplyFile(threadId: string, known: Set<string>, what: string, timeoutMs = 30_000): Promise<string> {
  return waitFor(
    async () => {
      const dir = path.join(COMMENTS_DIR, threadId);
      const files = readdirSync(dir, { withFileTypes: true })
        .filter((e) => e.isFile() && e.name.endsWith('.mdx') && e.name !== 'index.mdx')
        .map((e) => e.name.replace(/\.mdx$/, ''))
        .filter((id) => !known.has(id))
        .sort();
      return files.length > 0 ? (files[files.length - 1] as string) : undefined;
    },
    { timeoutMs, intervalMs: 300, what },
  );
}

export function replyIdsOf(threadId: string): string[] {
  const dir = path.join(COMMENTS_DIR, threadId);
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { withFileTypes: true })
    .filter((e) => e.isFile() && e.name.endsWith('.mdx') && e.name !== 'index.mdx')
    .map((e) => e.name.replace(/\.mdx$/, ''))
    .sort();
}

/** 测试自己创建的评论串（一切非样例串），收尾时清掉，把 comments/ 还原成样例 */
export function strayThreadDirs(): string[] {
  if (!existsSync(COMMENTS_DIR)) return [];
  return readdirSync(COMMENTS_DIR, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && entry.name !== SEED_THREAD && THREAD_ID.test(entry.name))
    .map((entry) => entry.name);
}

export function cleanupStrayThreads(): string[] {
  const strays = strayThreadDirs();
  for (const name of strays) {
    rmSync(path.join(COMMENTS_DIR, name), { recursive: true, force: true });
  }
  return strays;
}

export function logTail(log: string, lines = 30): string {
  const content = existsSync(log) ? readFileSync(log, 'utf-8') : '';
  return content.split('\n').slice(-lines).join('\n');
}
