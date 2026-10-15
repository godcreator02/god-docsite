import { afterEach, describe, expect, it } from 'vitest';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { checkReports } from '../src/node/index.ts';
import { main } from '../src/node/cli.ts';
import type { ReportDocument } from '../src/core/index.ts';
const temporary: string[] = [];
async function fixture() { const root = await mkdtemp(path.join(tmpdir(), 'report-check-test-')); temporary.push(root); return root; }
afterEach(async () => { for (const root of temporary.splice(0)) { if (!path.resolve(root).startsWith(path.resolve(tmpdir()) + path.sep + 'report-check-test-')) throw new Error('Unexpected temporary directory'); await rm(root, { recursive: true, force: true }); } });
const doc = (id: string): ReportDocument => ({ format: 'docreport', schemaVersion: 1, id, metadata: { title: id, language: 'zh-CN' }, blocks: [{ type: 'paragraph', id: `${id}_p`, content: [{ type: 'text', text: '正文' }] }] });
async function save(root: string, file: string, document: ReportDocument | string) { const absolute = path.join(root, file); await mkdir(path.dirname(absolute), { recursive: true }); await writeFile(absolute, typeof document === 'string' ? document : JSON.stringify(document)); }
describe('report CLI checks', () => {
  it('checks every chapter independently and composites in both modes', async () => {
    const root = await fixture(), main = doc('main');
    main.blocks = [{ type: 'include', src: 'chapters/a/content.json' }, { type: 'include', src: 'chapters/b/content.json' }];
    await save(root, 'reports/sample/content.json', main); await save(root, 'reports/sample/chapters/a/content.json', doc('a')); await save(root, 'reports/sample/chapters/b/content.json', doc('b'));
    const result = await checkReports(root);
    expect(result.checked).toBe(3); expect(result.runs).toHaveLength(4); expect(result.problems).toEqual([]);
    expect(result.runs.filter(x => x.mode === 'complete').map(x => x.file)).toEqual(['reports/sample/content.json']);
  });
  it('permits declared external references in a chapter but rejects unresolved references in a composite', async () => {
    const root = await fixture(), chapter = doc('a'), main = doc('main');
    chapter.blocks = [{ type: 'paragraph', id: 'p', content: [{ type: 'ref', id: 'r', target: 'missing', display: 'label', externalLabel: '外部公式' }] }];
    main.blocks = [{ type: 'include', src: 'chapters/a/content.json' }];
    await save(root, 'reports/sample/content.json', main); await save(root, 'reports/sample/chapters/a/content.json', chapter);
    const result = await checkReports(root);
    expect(result.problems).toHaveLength(1); expect(result.problems[0]!.mode).toBe('complete');
    expect(result.problems[0]!.file).toBe('reports/sample/chapters/a/content.json');
    expect(result.problems[0]!.pointer).toBe('/blocks/0/content/0'); expect(result.warnings).toHaveLength(2);
  });
  it('continues checking other documents after malformed JSON and reports locations', async () => {
    const root = await fixture(); await save(root, 'reports/a/content.json', '{"id":"a","id":"b"}'); await save(root, 'reports/b/content.json', doc('b'));
    const result = await checkReports(root);
    expect(result.checked).toBe(2); expect(result.problems).toHaveLength(1); expect(result.problems[0]!.file).toBe('reports/a/content.json');
    expect(result.problems[0]!.message).toContain('Duplicate JSON key'); expect(result.runs.some(x => x.passed)).toBe(true);
  });
  it('only scans report content.json files', async () => {
    const root = await fixture(); await save(root, 'writing/content.json', 'not json'); await save(root, 'reports/sample/chapters.json', 'not json');
    expect((await checkReports(root)).checked).toBe(0);
  });
  it('report-docx check --json：报告有问题时按 JSON 打出、退出码非零', async () => {
    const root = await fixture(); await save(root, 'reports/a/content.json', '{"bad":true}');
    const logs: string[] = [], errors: string[] = [];
    expect(await main(['check', '--site', root, '--json'], { stdout: text => logs.push(text), stderr: text => errors.push(text) })).toBe(1);
    expect(JSON.parse(logs[0]!).problems[0].file).toBe('reports/a/content.json'); expect(errors).toEqual([]);
  });
  it('report-docx check：认不出的命令报错；没有报告的站点通过', async () => {
    const root = await fixture(), errors: string[] = [], output = { stdout: (_text: string) => {}, stderr: (text: string) => { errors.push(text); } };
    expect(await main(['build', root], output)).toBe(1); expect(errors[0]).toContain('认不出的命令');
    expect(await main(['check', '--site', root], output)).toBe(0);
  });
});
