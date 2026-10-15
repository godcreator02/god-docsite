import { afterEach, describe, expect, it } from 'vitest';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import sharp from 'sharp';
import { readReport } from '../src/node/index.ts';
import { ReportContentError, type ReportDocument } from '../src/core/index.ts';
const temporary: string[] = [];
async function fixture() { const root = await mkdtemp(path.join(tmpdir(), 'report-content-test-')); temporary.push(root); return root; }
afterEach(async () => {
  for (const root of temporary.splice(0)) {
    if (!path.resolve(root).startsWith(path.resolve(tmpdir()) + path.sep + 'report-content-test-')) throw new Error('Unexpected temporary directory');
    await rm(root, { recursive: true, force: true });
  }
});
const doc = (id: string): ReportDocument => ({ format: 'docreport', schemaVersion: 1, id, metadata: { title: id, language: 'zh-CN' }, blocks: [{ type: 'section', id: `${id}_sec`, title: '章节', numbering: 'decimal', children: [{ type: 'figure', id: `${id}_fig`, src: 'assets/image.png', alt: '图片', caption: [{ type: 'text', text: '示意图' }] }] }] });
async function image(color: string) { return sharp({ create: { width: 4, height: 4, channels: 3, background: color } }).png().toBuffer(); }
describe('filesystem report input', () => {
  it('captures JSON and decoded image bytes, including same-name edits', async () => {
    const root = await fixture(); await mkdir(path.join(root, 'assets'));
    await writeFile(path.join(root, 'content.json'), JSON.stringify(doc('d')));
    await writeFile(path.join(root, 'assets/image.png'), await image('red'));
    const first = await readReport(path.join(root, 'content.json'));
    expect(first.snapshot.map(x => x.path)).toEqual(['assets/image.png', 'content.json']);
    expect(first.snapshot.every(x => /^[a-f0-9]{64}$/.test(x.sha256))).toBe(true);
    expect(first.assetBytes['assets/d/image.png']).toBeInstanceOf(Uint8Array);
    await writeFile(path.join(root, 'assets/image.png'), await image('blue'));
    expect((await readReport(path.join(root, 'content.json'))).fingerprint).not.toBe(first.fingerprint);
  });
  it('reads all referenced chapter dependencies and validates local images', async () => {
    const root = await fixture();
    const main = doc('main'); main.blocks = [{ type: 'include', src: 'a/content.json' }, { type: 'include', src: 'b/content.json' }];
    await writeFile(path.join(root, 'content.json'), JSON.stringify(main));
    for (const id of ['a', 'b']) {
      await mkdir(path.join(root, id, 'assets'), { recursive: true });
      await writeFile(path.join(root, id, 'content.json'), JSON.stringify(doc(id)));
      await writeFile(path.join(root, id, 'assets/image.png'), await image(id === 'a' ? 'red' : 'blue'));
    }
    const result = await readReport(path.join(root, 'content.json'));
    expect(result.dependencies).toEqual(['content.json', 'a/content.json', 'b/content.json']);
    expect(result.snapshot).toHaveLength(5);
    expect(Object.keys(result.assetBytes)).toEqual(['assets/a/image.png', 'assets/b/image.png']);
    const chapter = await readReport(path.join(root, 'b/content.json'));
    expect(chapter.dependencies).toEqual(['content.json']);
    expect(chapter.index.b_sec!.number).toBe('1');
  });
  it.each(['corrupt', 'encoding mismatch'])('rejects %s image data by decoding', async kind => {
    const root = await fixture(); await mkdir(path.join(root, 'assets'));
    await writeFile(path.join(root, 'content.json'), JSON.stringify(doc('d')));
    const bytes = kind === 'corrupt' ? Buffer.from('bad png') : await sharp({ create: { width: 2, height: 2, channels: 3, background: 'red' } }).jpeg().toBuffer();
    await writeFile(path.join(root, 'assets/image.png'), bytes);
    await expect(readReport(path.join(root, 'content.json'))).rejects.toThrow('Invalid image');
  });
  it('rejects missing assets and out-of-root entry files with typed errors', async () => {
    const root = await fixture(), outside = await fixture();
    await writeFile(path.join(root, 'content.json'), JSON.stringify(doc('d')));
    await writeFile(path.join(outside, 'content.json'), JSON.stringify(doc('o')));
    await expect(readReport(path.join(root, 'content.json'))).rejects.toThrow('Missing');
    await expect(readReport(path.join(outside, 'content.json'), { root })).rejects.toBeInstanceOf(ReportContentError);
    await expect(readReport(path.join(outside, 'content.json'), { root })).rejects.toThrow('escapes');
  });
  it('rejects duplicate JSON keys and missing include dependencies before resource reads', async () => {
    const root = await fixture(); await writeFile(path.join(root, 'content.json'), '{"id":"a","id":"b"}');
    await expect(readReport(path.join(root, 'content.json'))).rejects.toThrow('Duplicate JSON key');
    const input = doc('d'); input.blocks = [{ type: 'include', src: 'missing.json' }];
    await writeFile(path.join(root, 'content.json'), JSON.stringify(input));
    await expect(readReport(path.join(root, 'content.json'))).rejects.toThrow('missing.json');
  });
});
