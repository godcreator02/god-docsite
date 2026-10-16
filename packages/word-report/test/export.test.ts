import { createHash, randomUUID } from 'node:crypto';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import sharp from 'sharp';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const renderer = vi.hoisted(() => ({ spawn: vi.fn(), logFailure: false }));
vi.mock('node:child_process', () => ({ spawn: renderer.spawn }));
vi.mock('node:fs/promises', async (importOriginal) => {
  const original = await importOriginal<typeof import('node:fs/promises')>();
  return { ...original, writeFile: async (...args: Parameters<typeof original.writeFile>) => {
    if (renderer.logFailure && String(args[0]).endsWith('export.log')) throw new Error('Fixture export log write failed');
    return original.writeFile(...args);
  } };
});
import { reportEntry, reportExport, type ReportExportOptions } from '../src/node/export.ts';

const sha = (value: string | Uint8Array) => createHash('sha256').update(value).digest('hex');
const entry = 'reports/example/content.json';
let temporary: string, site: string, engine: string, packageDir: string;
const options = () => ({ siteDir: site, engineDir: engine, packageDir, entry });
const status = () => reportExport({ ...options(), action: 'status' });
const outputPaths = (id: string) => ({ docx: path.join(engine, 'out', id, 'result/report.docx'), pdf: path.join(engine, 'out', id, 'result/report.pdf') });

async function put(file: string, value: string | Uint8Array) {
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, value);
}
async function configureEngine() {
  for (const file of ['.venv/Scripts/python.exe', 'templates/project-report.dotx', 'schemas/report-content.schema.json', 'requirements.txt', 'pyproject.toml', 'src/docreport/__main__.py']) await put(path.join(engine, file), 'fixture only; never execute');
  for (const file of ['package.json', 'src/schema.ts', 'dist/assemble.js', 'dist/schema.js']) await put(path.join(packageDir, file), 'compiler fixture');
}
async function successfulJob(ownerSite = site) {
  const id = `web-${randomUUID()}`, output = Buffer.from('verified output fixture');
  await put(path.join(engine, 'out', id, 'result/report.docx'), output);
  await put(path.join(engine, 'out', id, 'result/report.pdf'), output);
  await put(path.join(engine, 'out', id, 'job.json'), JSON.stringify({ id, site: ownerSite, entry, mode: 'complete', state: 'ready', fingerprint: 'previous', outputs: { 'report.docx': sha(output), 'report.pdf': sha(output) } }));
  const key = sha(JSON.stringify([site, entry, 'complete']));
  await put(path.join(engine, 'out/web-index', `${key}.json`), JSON.stringify({ id }));
  return id;
}

beforeEach(async () => {
  temporary = await mkdtemp(path.join(os.tmpdir(), 'docsite-export-test-'));
  site = path.join(temporary, 'workspace/full-test/site'); engine = path.join(temporary, 'engine'); packageDir = path.join(temporary, 'package');
  vi.stubEnv('DOCREPORT_ENGINE_ROOT', undefined);
  renderer.spawn.mockReset();
  renderer.logFailure = false;
  renderer.spawn.mockImplementation(() => { throw new Error('Fixture renderer intentionally unavailable'); });
  await put(path.join(site, entry), JSON.stringify({
    format: 'docreport', schemaVersion: 1, id: 'doc_fixture', metadata: { title: '导出命令测试', language: 'zh-CN' },
    blocks: [{ type: 'paragraph', id: 'p_fixture', content: [{ type: 'text', text: '固定输入正文' }] }],
  }));
});
afterEach(async () => {
  vi.unstubAllEnvs();
  // Remove only the unique test directory just created under the OS temp root.
  const resolved = path.resolve(temporary);
  if (path.dirname(resolved) !== path.resolve(os.tmpdir()) || !path.basename(resolved).startsWith('docsite-export-test-')) throw new Error('Unexpected fixture cleanup target');
  await rm(resolved, { recursive: true, force: true });
});

describe('Word 导出 Node 命令（禁止启动实际 Word）', () => {
  it('报告入口拒绝目录逃逸、机器路径及非content.json文件', () => {
    expect(reportEntry(entry)).toBe(entry);
    for (const value of ['../content.json', '/reports/content.json', 'C:\\content.json', 'reports//content.json', 'reports/./content.json', 'reports/other.json', null, 1]) expect(() => reportEntry(value)).toThrow('报告入口要是站点目录里的相对 content.json 路径');
  });

  it('入口、模式、操作及路径参数错误抛错，不启动 renderer', async () => {
    for (const invalid of [{ entry: '../content.json' }, { mode: 'invalid' }, { action: 'download' }, { action: '' }, { siteDir: '' }, { engineDir: 1 }, { packageDir: 1 }, { expectedFingerprint: 1 }]) {
      await expect(reportExport({ ...options(), ...invalid } as ReportExportOptions)).rejects.toThrow();
    }
    expect(renderer.spawn).not.toHaveBeenCalled();
  });

  it('无Python环境保留以前成功导出的绝对路径', async () => {
    const id = await successfulJob();
    expect(await status()).toMatchObject({ state: 'unavailable', ...outputPaths(id) });
    expect(renderer.spawn).not.toHaveBeenCalled();
  });

  it('坏JSON快照返回failed，保留之前成功产物', async () => {
    await configureEngine();
    const id = await successfulJob();
    await put(path.join(site, entry), '{ broken');
    expect(await reportExport(options())).toMatchObject({ state: 'failed', stale: true, ...outputPaths(id) });
    expect(renderer.spawn).not.toHaveBeenCalled();
  });

  it('报告里有多图时返回 failed，写明 Word 还不支持多图，不启动 Word', async () => {
    await configureEngine();
    const png = await sharp({ create: { width: 2, height: 2, channels: 3, background: '#888' } }).png().toBuffer();
    for (const name of ['a.png', 'b.png']) await put(path.join(site, 'reports/example/assets', name), png);
    await put(path.join(site, entry), JSON.stringify({
      format: 'docreport', schemaVersion: 1, id: 'doc_fixture', metadata: { title: '导出命令测试', language: 'zh-CN' },
      blocks: [{ type: 'figure', id: 'fig_grid', columns: 2, caption: [{ type: 'text', text: '两张图' }], panels: [{ id: 'pa', src: 'assets/a.png', alt: 'a' }, { id: 'pb', src: 'assets/b.png', alt: 'b' }] }],
    }));
    expect(await reportExport(options())).toMatchObject({ state: 'failed', message: expect.stringContaining('导出 Word 还不支持多图') });
    expect(renderer.spawn).not.toHaveBeenCalled();
  });

  it('报告hash变化拒绝启动，未建立Word任务', async () => {
    await configureEngine();
    await expect(reportExport({ ...options(), expectedFingerprint: 'outdated' })).rejects.toThrow('报告内容已变化');
    expect(renderer.spawn).not.toHaveBeenCalled();
  });

  it('活进程持锁时拒绝第二任务', async () => {
    await configureEngine();
    await put(path.join(engine, 'out/.web-export.lock'), JSON.stringify({ id: `web-${randomUUID()}`, pid: process.pid }));
    await expect(reportExport(options())).rejects.toMatchObject({ state: 'locked', message: expect.stringContaining('Word 正在生成') });
    expect(renderer.spawn).not.toHaveBeenCalled();
  });

  it('同时启动两份报告只有一个能取得 renderer 锁', async () => {
    await configureEngine();
    const results = await Promise.allSettled([reportExport(options()), reportExport(options())]);
    const started = results.filter((result) => result.status === 'fulfilled');
    expect(started).toHaveLength(1);
    expect(results.filter((result) => result.status === 'rejected')).toHaveLength(1);
    await vi.waitFor(async () => {
      expect((await status()).state).toBe('failed');
      await expect(readFile(path.join(engine, 'out/.web-export.lock'))).rejects.toMatchObject({ code: 'ENOENT' });
    });
    expect(renderer.spawn).toHaveBeenCalledOnce();
  });

  it('默认start/complete立刻返回running，子进程启动失败记录失败并保留上次成功结果', async () => {
    await configureEngine();
    const previousId = await successfulJob();
    const result = await reportExport(options());
    expect(result).toMatchObject({ state: 'running', ...outputPaths(previousId) });
    const { jobId } = result;
    await vi.waitFor(async () => {
      expect(await status()).toMatchObject({ state: 'failed', jobId, ...outputPaths(previousId) });
      await expect(readFile(path.join(engine, 'out/.web-export.lock'))).rejects.toMatchObject({ code: 'ENOENT' });
    });
    const job = JSON.parse(await readFile(path.join(engine, 'out', jobId!, 'job.json'), 'utf8'));
    expect(job).toMatchObject({ mode: 'complete', message: expect.stringContaining('Fixture renderer intentionally unavailable') });
    expect(renderer.spawn).toHaveBeenCalledOnce();
    expect(renderer.spawn.mock.calls[0]![1]).toContain('--data-only');
    const snapshot = JSON.parse(await readFile(path.join(engine, 'out', jobId!, 'input/content.json'), 'utf8'));
    expect(snapshot.blocks[0].content[0].text).toBe('固定输入正文');
  });

  it('状态产物属于当前站点，并在返回绝对路径前重新验证两个文件hash', async () => {
    await configureEngine();
    const id = await successfulJob();
    expect(await status()).toMatchObject({ state: 'ready', ...outputPaths(id) });
    for (const extension of ['docx', 'pdf']) {
      await put(path.join(engine, 'out', id, `result/report.${extension}`), 'tampered');
      await expect(status()).rejects.toThrow('生成文件与验收记录不一致');
      await put(path.join(engine, 'out', id, `result/report.${extension}`), 'verified output fixture');
    }
    await successfulJob(path.join(temporary, 'other-site'));
    expect(await status()).toMatchObject({ state: 'idle' });
    expect((await status()).docx).toBeUndefined();
  });

  it('空锁给出明确异常而不抢占', async () => {
    await configureEngine();
    const lock = path.join(engine, 'out/.web-export.lock');
    await put(lock, '');
    await expect(reportExport(options())).rejects.toMatchObject({ state: 'lock-invalid' });
    expect(await readFile(lock, 'utf8')).toBe('');
    expect(renderer.spawn).not.toHaveBeenCalled();
  });

  it('父Node退出但Python renderer仍存活时保持互斥', async () => {
    await configureEngine();
    const lock = path.join(engine, 'out/.web-export.lock');
    await put(lock, JSON.stringify({ id: `web-${randomUUID()}`, pid: process.pid, ownerPid: 99999999, rendererPid: process.pid, phase: 'rendering' }));
    await expect(reportExport(options())).rejects.toMatchObject({ state: 'locked' });
    expect(renderer.spawn).not.toHaveBeenCalled();
  });

  it('已退出进程的锁保持原样并给出清理提示', async () => {
    await configureEngine();
    const lock = path.join(engine, 'out/.web-export.lock');
    const bytes = JSON.stringify({ id: `web-${randomUUID()}`, pid: 99999999 });
    await put(lock, bytes);
    await expect(reportExport(options())).rejects.toMatchObject({ state: 'lock-orphaned', message: expect.stringContaining('锁仍保留') });
    expect(await readFile(lock, 'utf8')).toBe(bytes);
    expect(renderer.spawn).not.toHaveBeenCalled();
  });

  it('日志落盘失败也释放锁，失败状态持久化', async () => {
    await configureEngine();
    renderer.logFailure = true;
    const { jobId, state } = await reportExport(options());
    expect(state).toBe('running');
    await vi.waitFor(async () => {
      await expect(readFile(path.join(engine, 'out/.web-export.lock'))).rejects.toMatchObject({ code: 'ENOENT' });
      const result = JSON.parse(await readFile(path.join(engine, 'out', jobId!, 'job.json'), 'utf8'));
      expect(result).toMatchObject({ state: 'failed', message: expect.stringContaining('Fixture export log write failed') });
    });
  });

  it('不给引擎目录时用环境变量 DOCREPORT_ENGINE_ROOT', async () => {
    await configureEngine();
    vi.stubEnv('DOCREPORT_ENGINE_ROOT', engine);
    expect(await reportExport({ siteDir: site, packageDir, entry, action: 'status' })).toMatchObject({ state: 'idle' });
    expect(renderer.spawn).not.toHaveBeenCalled();
  });

  it('默认用本包自带的 engine/；那里还没有 Python 环境时说明怎么配', async () => {
    expect(await reportExport({ siteDir: site, packageDir, entry, action: 'status' })).toMatchObject({
      state: 'unavailable',
      message: expect.stringContaining(`Word 引擎 ${path.join(packageDir, 'engine')} 里还没有 Python 环境`),
    });
  });

  it('compiler构建代码或协议变化使报告fingerprint变化', async () => {
    await configureEngine();
    const before = await status();
    await put(path.join(packageDir, 'dist/assemble.js'), 'changed compiler');
    const afterBuild = await status();
    expect(afterBuild.fingerprint).not.toBe(before.fingerprint);
    await put(path.join(packageDir, 'src/schema.ts'), 'changed protocol');
    const afterSchema = await status();
    expect(afterSchema.fingerprint).not.toBe(afterBuild.fingerprint);
  });

  it('重启后从磁盘恢复已完成但Node未登记的成功结果', async () => {
    await configureEngine();
    const { jobId } = await reportExport(options());
    const directory = path.join(engine, 'out', jobId!);
    await vi.waitFor(async () => {
      expect(JSON.parse(await readFile(path.join(directory, 'job.json'), 'utf8')).state).toBe('failed');
      await expect(readFile(path.join(engine, 'out/.web-export.lock'))).rejects.toMatchObject({ code: 'ENOENT' });
    });
    const bytes = Buffer.from('recovered output'), outputs = { 'report.docx': sha(bytes), 'report.pdf': sha(bytes) };
    for (const name of Object.keys(outputs)) await put(path.join(directory, 'result', name), bytes);
    await put(path.join(directory, 'result/verification.json'), JSON.stringify({ status: 'passed_automation_visual_review_pending', events: [{ event: 'document-check', pages: 3 }] }));
    await put(path.join(directory, 'result/manifest.json'), JSON.stringify({ outputs }));
    const job = JSON.parse(await readFile(path.join(directory, 'job.json'), 'utf8'));
    job.state = 'running'; delete job.message;
    await put(path.join(directory, 'job.json'), JSON.stringify(job));
    expect(await status()).toMatchObject({ state: 'ready', jobId, checks: { pages: 3 }, visualReview: 'pending', ...outputPaths(jobId!) });
  });
});
