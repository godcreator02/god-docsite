import { createHash } from 'node:crypto';
import { readFile, realpath, stat } from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import { assembleDocument } from '../core/assemble.ts';
import { parseReportJson } from '../core/json.ts';
import { assembleMdxReport, MDX_ENTRY_NAME, mdxReportInputsOf } from '../core/mdx/index.ts';
import { safeRelativePath, validateDocument } from '../core/validate.ts';
import { ReportContentError, type AssemblyOptions, type AssemblyResult } from '../core/types.ts';
export interface SnapshotEntry { path: string; sha256: string; size: number }
export interface ReadReportResult extends AssemblyResult {
  files: Record<string, string>;
  snapshot: SnapshotEntry[];
  fingerprint: string;
  assetBytes: Record<string, Uint8Array>;
}
const sha = (bytes: Uint8Array | string) => createHash('sha256').update(bytes).digest('hex');

/** Reads real paths and decodes actual PNG/JPEG bytes before any Word process starts. */
export async function readReport(entryAbsolute: string, options: AssemblyOptions & { root?: string } = {}): Promise<ReadReportResult> {
  let entry: string;
  try { entry = await realpath(path.resolve(entryAbsolute)); } catch { throw new ReportContentError('Missing entry document', entryAbsolute); }
  let root: string;
  try { root = await realpath(options.root ?? path.dirname(entry)); } catch { throw new ReportContentError('Missing report root', options.root ?? path.dirname(entry)); }
  const files: Record<string, string> = Object.create(null);
  const snapshotByFile = new Map<string, SnapshotEntry>(), visiting = new Set<string>();
  const relative = (absolute: string) => path.relative(root, absolute).split(path.sep).join('/');
  async function readWithin(absolute: string): Promise<{ bytes: Buffer; key: string }> {
    let real: string;
    try { real = await realpath(absolute); } catch { throw new ReportContentError('Missing or unreadable file', relative(absolute)); }
    const inside = path.relative(root, real);
    if (inside === '..' || inside.startsWith('..' + path.sep) || path.isAbsolute(inside)) throw new ReportContentError('File escapes report root', relative(absolute));
    const key = relative(absolute);
    try {
      const bytes = await readFile(real);
      snapshotByFile.set(key, { path: key, sha256: sha(bytes), size: bytes.length });
      return { bytes, key };
    } catch { throw new ReportContentError('Unreadable report file', key); }
  }
  async function readText(absolute: string, format: string): Promise<string> {
    const { bytes, key } = await readWithin(absolute);
    try { return new TextDecoder('utf-8', { fatal: true }).decode(bytes); } catch { throw new ReportContentError(`Document must be UTF-8 ${format}`, key); }
  }
  async function load(absolute: string): Promise<void> {
    const key = relative(absolute);
    if (visiting.has(key)) throw new ReportContentError('Circular document include', key);
    if (Object.hasOwn(files, key)) return; // Pure assembler reports repeated includes with source context.
    visiting.add(key);
    const text = await readText(absolute, 'JSON');
    files[key] = text;
    const document = parseReportJson(text, key); validateDocument(document, key);
    for (const [i, block] of document.blocks.entries()) if (block.type === 'include') {
      try { safeRelativePath(block.src); } catch (e) { throw new ReportContentError((e as Error).message, key, `/blocks/${i}/src`); }
      await load(path.resolve(path.dirname(absolute), block.src));
    }
    visiting.delete(key);
  }
  /** MDX 报告：入口、各章与文献列表都进快照，编译成一份文档再组装 */
  async function loadMdx(): Promise<AssemblyResult> {
    const entryKey = relative(entry);
    files[entryKey] = await readText(entry, 'MDX');
    const { chapters, references } = mdxReportInputsOf(files[entryKey]!, entryKey);
    for (const chapter of chapters) files[chapter] = await readText(path.resolve(root, chapter), 'MDX');
    const referencesExist = await stat(path.resolve(root, references)).then(info => info.isFile(), (error: NodeJS.ErrnoException) => { if (error.code === 'ENOENT') return false; throw error; });
    if (referencesExist) files[references] = await readText(path.resolve(root, references), 'MDX');
    return assembleMdxReport({ reportId: path.basename(path.dirname(entry)), entry: entryKey, files }, options);
  }
  let result: AssemblyResult;
  if (path.basename(entry) === MDX_ENTRY_NAME) result = await loadMdx();
  else { await load(entry); result = assembleDocument(relative(entry), files, options); }
  const assetBytes: Record<string, Uint8Array> = Object.create(null), normalized = new Map<string, string>();
  for (const [src, source] of Object.entries(result.assets)) {
    const folded = source.normalize('NFC').toLowerCase(), previous = normalized.get(folded);
    if (previous && previous !== source) throw new ReportContentError('Asset names collide on Windows', source);
    normalized.set(folded, source);
    const { bytes } = await readWithin(path.resolve(root, source));
    try {
      const decoder = sharp(bytes, { failOn: 'warning', limitInputPixels: 100_000_000 });
      const metadata = await decoder.metadata();
      const expected = src.endsWith('.png') ? 'png' : 'jpeg';
      if (metadata.format !== expected || !metadata.width || !metadata.height) throw new Error('Image encoding does not match extension');
      await decoder.raw().toBuffer();
    } catch (e) { throw new ReportContentError(`Invalid image: ${(e as Error).message}`, source); }
    assetBytes[src] = bytes;
  }
  // Detect concurrent edits while capturing dependencies; exported bytes retain one verified snapshot.
  for (const record of snapshotByFile.values()) {
    const absolute = path.resolve(root, record.path);
    let current: Buffer;
    try {
      const real = await realpath(absolute), inside = path.relative(root, real);
      if (inside === '..' || inside.startsWith('..' + path.sep) || path.isAbsolute(inside)) throw new Error('escaped');
      current = await readFile(real);
    } catch { throw new ReportContentError('Input disappeared or escaped while taking snapshot', record.path); }
    if (sha(current) !== record.sha256) throw new ReportContentError('Input changed while taking snapshot; retry export', record.path);
  }
  const snapshot = [...snapshotByFile.values()].sort((a, b) => a.path < b.path ? -1 : a.path > b.path ? 1 : 0);
  return { ...result, files, snapshot, fingerprint: sha(JSON.stringify(snapshot)), assetBytes };
}
