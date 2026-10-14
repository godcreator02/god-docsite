import { spawn, spawnSync } from 'node:child_process';
import { createWriteStream, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const probeDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const siteDir = path.join(probeDir, 'site');
export const runsDir = path.join(probeDir, 'runs');
export const reactRouterBin = path.join(siteDir, 'node_modules', '@react-router', 'dev', 'bin.cjs');
export const reactRouterServeBin = path.join(siteDir, 'node_modules', '@react-router', 'serve', 'bin.cjs');
export const demoCounterFile = path.join(siteDir, 'data', 'demo-counter.json');

let runLogsDir = runsDir;

// 每次运行一个子目录，不覆盖以前的记录
export function useRunLogDir(runName) {
  runLogsDir = path.join(runsDir, runName);
  mkdirSync(runLogsDir, { recursive: true });
  return runLogsDir;
}

export function logPath(name) {
  mkdirSync(runLogsDir, { recursive: true });
  return path.join(runLogsDir, name);
}

export function resetDemoCounterFile() {
  writeFileSync(demoCounterFile, `${JSON.stringify({ count: 0, updatedAt: null }, null, 2)}\n`);
}

// 命令输出整份写进日志文件；退出码不为 0 时不抛错，由调用方判定
export function runLogged(command, args, { cwd, env, logName, timeoutMs }) {
  const file = logPath(logName);
  const result = spawnSync(command, args, {
    cwd,
    env: { ...process.env, ...env },
    encoding: 'utf8',
    timeout: timeoutMs,
    shell: process.platform === 'win32' && !command.endsWith('.exe') && command !== process.execPath,
    maxBuffer: 256 * 1024 * 1024,
  });
  const text = `$ ${command} ${args.join(' ')}\n(cwd ${cwd})\n\n${result.stdout ?? ''}\n--- stderr ---\n${result.stderr ?? ''}\n--- exit ${result.status} signal ${result.signal} error ${result.error?.message ?? ''}\n`;
  writeFileSync(file, text);
  return { status: result.status, output: `${result.stdout ?? ''}${result.stderr ?? ''}`, logFile: file, timedOut: result.error?.code === 'ETIMEDOUT' };
}

// 端口被别的进程占着时，就绪探测会打到别人的服务上，所以启动前先确认端口空闲
export async function assertPortFree(port) {
  const { createServer } = await import('node:net');
  await new Promise((resolve, reject) => {
    const probe = createServer();
    probe.once('error', () => reject(new Error(`端口 ${port} 已被占用，换一个端口或先停掉占用它的进程`)));
    probe.listen(port, '127.0.0.1', () => probe.close(resolve));
  });
}

export function startServer({ name, args, port, env, logName }) {
  const file = logPath(logName);
  const log = createWriteStream(file);
  log.write(`$ node ${args.join(' ')}\n(cwd ${siteDir}, port ${port})\n\n`);
  const child = spawn(process.execPath, args, {
    cwd: siteDir,
    env: { ...process.env, ...env },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let output = '';
  const collect = (chunk) => {
    output += chunk.toString();
    log.write(chunk);
  };
  child.stdout.on('data', collect);
  child.stderr.on('data', collect);
  const exited = new Promise((resolve) => child.on('exit', (code, signal) => resolve({ code, signal })));
  return {
    name,
    port,
    child,
    exited,
    logFile: file,
    output: () => output,
    async stop() {
      if (child.exitCode === null && child.signalCode === null) {
        if (process.platform === 'win32') spawnSync('taskkill', ['/pid', String(child.pid), '/T', '/F'], { stdio: 'ignore' });
        else child.kill('SIGTERM');
      }
      await exited;
      await new Promise((resolve) => log.end(resolve));
    },
  };
}

export async function waitForHttp(url, { timeoutMs, server }) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (server && server.child.exitCode !== null) {
      throw new Error(`${server.name} 在就绪前退出（exit ${server.child.exitCode}），日志 ${server.logFile}`);
    }
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(2000) });
      await response.arrayBuffer();
      return response.status;
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
  }
  throw new Error(`等 ${url} 就绪超时（${timeoutMs} ms）`);
}

export function assertSiteInstalled() {
  if (!existsSync(reactRouterBin)) throw new Error(`没找到 ${reactRouterBin}：先在实验目录运行 pnpm install`);
}
