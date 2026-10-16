import { parseReportJson } from './json.js';
import { safeRelativePath, stableValue, validateDocument, validateTable, walk } from './validate.js';
import { ReportContentError, type AssemblyOptions, type AssemblyResult, type ReportDocument, type SourceLocation } from './types.js';
const join = (file: string, relative: string) => [file.split('/').slice(0, -1).join('/'), relative].filter(Boolean).join('/');
const plain = (content: any[] = []) => content.map(n => n.type === 'text' ? n.text : n.type === 'break' ? ' ' : '').join('');

export function assembleDocument(entry: string, files: Record<string, string | ReportDocument>, options: AssemblyOptions = {}): AssemblyResult {
  safeRelativePath(entry);
  const sources: AssemblyResult['sources'] = Object.create(null), assets: AssemblyResult['assets'] = Object.create(null);
  const warnings: AssemblyResult['warnings'] = [], dependencies: string[] = [], index: AssemblyResult['index'] = Object.create(null);
  const seen = new Set<string>(), active = new Set<string>(), ids = new Map<string, Record<string, any>>();
  const notes: NonNullable<ReportDocument['notes']> = [], references: NonNullable<ReportDocument['references']> = [];
  const refById = new Map<string, NonNullable<ReportDocument['references']>[number]>();
  const pending = new Map<string, SourceLocation>();
  const resourceNames = new Map<string, string>();
  let rootBibliography: Record<string, any> | undefined;
  /** 图片路径改成按文档 id 分开的 assets/<文档 id>/…，同名的章节图片不互相覆盖 */
  function registerAsset(image: Record<string, any>, file: string, srcPointer: string) {
    try { safeRelativePath(image.src, true); } catch (e) { throw new ReportContentError((e as Error).message, file, srcPointer); }
    const original = join(file, image.src), namespace = documents.get(file)!.id;
    const output = `assets/${namespace}/${image.src.slice(7)}`;
    for (const resource of [original, output]) {
      const key = resource.normalize('NFC').toLowerCase(), previous = resourceNames.get(key);
      if (previous && previous !== resource) throw new ReportContentError('Asset names collide on Windows', file, srcPointer);
      resourceNames.set(key, resource);
    }
    assets[output] = original; image.src = output;
  }
  function register(value: unknown, file: string, prefix: string) {
    for (const { node, pointer } of walk(value, prefix)) {
      if (node.id !== undefined) {
        if (ids.has(node.id)) throw new ReportContentError(`Duplicate ID: ${node.id}`, file, pointer);
        ids.set(node.id, node); sources[node.id] = { file, pointer };
      }
      if (node.type === 'figure') {
        const images: [Record<string, any>, string][] = node.panels ? node.panels.map((panel: Record<string, any>, k: number) => [panel, `${pointer}/panels/${k}/src`]) : [[node, `${pointer}/src`]];
        for (const [image, srcPointer] of images) registerAsset(image, file, srcPointer);
      }
    }
  }
  const documents = new Map<string, ReportDocument>();
  function load(file: string): ReportDocument {
    if (active.has(file)) throw new ReportContentError('Circular document include', file);
    if (seen.has(file)) throw new ReportContentError('Repeated document include', file);
    if (!Object.hasOwn(files, file)) throw new ReportContentError('Missing document dependency', file);
    seen.add(file); active.add(file); dependencies.push(file);
    const input = files[file];
    const value: unknown = typeof input === 'string' ? parseReportJson(input, file) : structuredClone(input);
    validateDocument(value, file); const document = value;
    documents.set(file, document);
    register({ id: document.id }, file, '');
    // Metadata fields are entry-template bindings; child metadata never enters the composite.
    if (file === entry) register(document.metadata, file, '/metadata');
    for (let i = 0; i < (document.notes?.length ?? 0); i++) {
      const note = document.notes![i]!; register(note, file, `/notes/${i}`); notes.push(note);
    }
    for (let i = 0; i < (document.references?.length ?? 0); i++) {
      const reference = document.references![i]!, previous = refById.get(reference.id);
      if (previous) {
        if (stableValue(previous) !== stableValue(reference)) throw new ReportContentError(`Conflicting bibliography entry: ${reference.id}`, file, `/references/${i}`);
      } else { register(reference, file, `/references/${i}`); references.push(reference); refById.set(reference.id, reference); }
    }
    const expanded: ReportDocument['blocks'] = [];
    for (let i = 0; i < document.blocks.length; i++) {
      const block = document.blocks[i]!;
      if (block.type === 'include') {
        let target: string;
        try { target = join(file, safeRelativePath(block.src)); } catch (e) { throw new ReportContentError((e as Error).message, file, `/blocks/${i}/src`); }
        expanded.push(...load(target).blocks);
      } else {
        register(block, file, `/blocks/${i}`);
        const retained = collectBibliographies([block], file);
        expanded.push(...retained);
      }
    }
    document.blocks = expanded;
    active.delete(file); return document;
  }
  function collectBibliographies(blocks: any[], file: string): any[] {
    return blocks.filter(block => {
      if (block.type === 'bibliography') {
        pending.set(block.id, sources[block.id]!);
        if (file !== entry) return false;
        if (rootBibliography) throw new ReportContentError('Multiple root bibliography blocks', file, sources[block.id]!.pointer);
        rootBibliography = block;
      }
      if (block.type === 'section') {
        block.children = collectBibliographies(block.children, file);
        if (!block.children.length) throw new ReportContentError('Included section became empty after collecting bibliography; use a top-level bibliography marker', file, sources[block.id]!.pointer);
      }
      return true;
    });
  }
  const document = load(entry);
  document.notes = notes; document.references = references;
  if (references.length && !rootBibliography) {
    const id = `${document.id.slice(0, 48)}_bibliography`;
    if (ids.has(id)) throw new ReportContentError(`Generated bibliography ID collides: ${id}`, entry);
    const block = { type: 'bibliography' as const, id }; document.blocks.push(block); register(block, entry, '/blocks/generated');
  }
  // Dropped child markers retain source records, but cannot serve as content targets.
  for (const id of pending.keys()) if (id !== rootBibliography?.id) ids.delete(id);
  const fail = (node: Record<string, any>, message: string): never => {
    const source = sources[node.id] ?? { file: entry, pointer: '' };
    throw new ReportContentError(`${node.id ?? document.id}: ${message}`, source.file, source.pointer);
  };
  const objects = [...walk(document)];
  const abstracts = objects.filter(x => x.node.type === 'abstract');
  if (abstracts.length > 1) fail(abstracts[1]!.node, 'Multiple abstracts require explicit editorial resolution');
  if (abstracts.length && document.blocks[0] !== abstracts[0]!.node) fail(abstracts[0]!.node, 'Abstract must be the first top-level block');
  for (const { node } of objects) {
    if (node.type === 'abstract' && (node.keywords.some((x: string) => x !== x.trim()) || node.paragraphs.some((x: any) => !x.content.length))) fail(node, 'Abstract requires nonempty paragraphs and trimmed keywords');
    if (node.type === 'table') { const source = sources[node.id]!; validateTable(node, source.file, source.pointer); }
    if (node.type === 'math' || node.type === 'equation') {
      const latex = node.latex.trim();
      if (!latex || /[^\x00-\x7f]/.test(latex) || /^(\$|\\\(|\\\[)/.test(latex) || /\\(?:tag|label|documentclass)\b|\\begin\s*\{document\}/.test(latex)) fail(node, 'MathType requires nonempty ASCII TeX without delimiters or manual numbering');
      if (latex.startsWith('\\begin{aligned}') && latex.endsWith('\\end{aligned}')) {
        const body = latex.slice(15, -13);
        if (body.split('\\\\').some((row: string) => row.split('&').length !== 2)) fail(node, 'Only two-column aligned formulas are supported');
      }
    }
    const rawUrl = node.type === 'link' ? node.href : node.url;
    if (rawUrl !== undefined) { try { const url = new URL(rawUrl); if (!['http:', 'https:'].includes(url.protocol) || !url.hostname) fail(node, 'Invalid URL'); } catch { fail(node, 'Invalid URL'); } }
  }
  const counts = { decimal: 0, appendix: 0, figure: 0, table: 0 };
  let appendixSeen = false;
  const eqCounts = new Map<string, number>();
  function blockNumbers(blocks: any[], depth = 0, chapter?: string, parentNumber?: string, parentMode?: string, tables = 0) {
    let decimal = 0;
    for (const node of blocks) {
      let number: string | undefined, label = '', title = node.title ?? plain(node.caption);
      if (node.type === 'section') {
        if (depth >= 6) fail(node, 'At most six heading levels');
        if (node.numbering === 'appendix' && depth !== 0) fail(node, 'Appendix must be top-level');
        if (parentMode === 'none' && node.numbering !== 'none') fail(node, 'Numbered section inside unnumbered section');
        if (depth === 0) {
          if (node.numbering === 'decimal') { if (appendixSeen) fail(node, 'Main chapter after appendix'); number = String(++counts.decimal); }
          if (node.numbering === 'appendix') { appendixSeen = true; number = alphabet(++counts.appendix); }
        } else if (node.numbering === 'decimal') number = `${parentNumber}.${++decimal}`;
        label = number ? node.numbering === 'appendix' ? `附录 ${number}` : `第 ${number} 节` : title;
        index[node.id] = { type: node.type, number, label, title };
        blockNumbers(node.children, depth + 1, depth === 0 && number ? number : chapter, number, node.numbering, tables);
        continue;
      }
      if (node.type === 'figure') { number = String(++counts.figure); label = `图 ${number}`; }
      if (node.type === 'table' && node.numbered) { number = String(++counts.table); label = `表 ${number}`; }
      if (node.type === 'equation' && node.numbered) {
        if (!chapter) fail(node, 'Numbered equation outside a numbered chapter');
        const n = (eqCounts.get(chapter!) ?? 0) + 1; eqCounts.set(chapter!, n); number = `${chapter}-${n}`; label = `式（${number}）`;
      }
      if (node.id) index[node.id] = { type: node.type, number, label, title };
      if (node.type === 'figure' && node.panels) node.panels.forEach((panel: Record<string, any>, k: number) => {
        const panelNumber = `${number}${panelLetter(k)}`;
        index[panel.id] = { type: 'figure-panel', number: panelNumber, label: `图 ${panelNumber}`, title: plain(panel.caption) };
      });
      if (node.type === 'table') {
        if (tables >= 6) fail(node, 'At most six table levels');
        for (const row of node.rows) for (const cell of row.cells) blockNumbers(cell.blocks, depth, chapter, parentNumber, parentMode, tables + 1);
      }
      if (node.type === 'list') for (const item of node.items) blockNumbers(item.blocks, depth, chapter, parentNumber, parentMode, tables);
    }
  }
  blockNumbers(document.blocks);
  const noteUses = new Map<string, number>(), citationOrder: string[] = [];
  const noteMap = new Map(notes.map(n => [n.id, n]));
  function reading(value: unknown, inNote = false): void {
    if (Array.isArray(value)) { for (const item of value) reading(item, inNote); return; }
    if (!value || typeof value !== 'object') return;
    const node = value as Record<string, any>;
    if (node.type === 'note_ref') {
      if (inNote) fail(node, 'Nested notes are not supported');
      const note = noteMap.get(node.target); if (!note) fail(node, 'Unknown note');
      const count = (noteUses.get(node.target) ?? 0) + 1; noteUses.set(node.target, count);
      if (!index[node.target]) { const number = String(noteUses.size); index[node.target] = { type: 'note', number, label: number, title: '' }; }
      reading(note!.blocks, true);
    }
    if (node.type === 'cite') for (const target of node.targets) { if (!refById.has(target)) fail(node, `Unknown bibliography entry: ${target}`); if (!citationOrder.includes(target)) citationOrder.push(target); }
    for (const child of Object.values(node)) reading(child, inNote);
  }
  reading(document.blocks);
  for (const note of notes) if (noteUses.get(note.id) !== 1) fail(note, 'Each note must have exactly one note_ref');
  for (const reference of references) if (!citationOrder.includes(reference.id)) citationOrder.push(reference.id);
  for (const [i, id] of citationOrder.entries()) index[id] = { type: 'reference', number: String(i + 1), label: `[${i + 1}]`, title: refById.get(id)!.text };
  function refs(value: unknown) {
    if (Array.isArray(value)) { for (let i = 0; i < value.length; i++) {
      const node = value[i];
      if (node?.type === 'ref') {
        const target = ids.get(node.target);
        if (!target) {
          if (options.mode === 'standalone' && node.externalLabel) {
            warnings.push({ ...sources[node.id]!, id: node.id, message: `External reference: ${node.externalLabel}` });
            value[i] = { type: 'text', text: node.externalLabel }; continue;
          }
          fail(node, `Unknown reference target: ${node.target}`);
        }
        if (index[node.target]?.type === 'figure-panel') {
          if (node.display === 'title' && (!target!.caption?.length || target!.caption.some((x: any) => !['text', 'break'].includes(x.type)))) fail(node, 'Title reference requires plain caption');
          delete node.externalLabel; continue;
        }
        if (!['section', 'figure', 'table', 'equation'].includes(target!.type)) fail(node, 'Invalid reference target type');
        if (target!.type === 'equation' && (!target!.numbered || node.display === 'title')) fail(node, 'Equation has no requested label');
        if (target!.type === 'section' && target!.numbering === 'none' && node.display !== 'title') fail(node, 'Section is not numbered');
        if (target!.type === 'table' && !target!.numbered && node.display !== 'title') fail(node, 'Table is not numbered');
        if (node.display === 'title' && ['figure', 'table'].includes(target!.type) && (!target!.caption?.length || target!.caption.some((x: any) => !['text', 'break'].includes(x.type)))) fail(node, 'Title reference requires plain caption');
        delete node.externalLabel;
      }
      refs(node);
    } } else if (value && typeof value === 'object') for (const child of Object.values(value)) refs(child);
  }
  refs(document);
  for (const { node } of walk(document)) if (node.id && !index[node.id]) index[node.id] = { type: node.type ?? 'record', label: '', title: node.title ?? node.label ?? '' };
  validateDocument(document, entry);
  return { document, index, sources, assets, dependencies, warnings };
}
/** 多图里第 k 张（从 0 起）的编号：(a)、(b)……，schema 限定至多 26 张 */
export function panelLetter(k: number): string { return `(${String.fromCharCode(97 + k)})`; }
function alphabet(n: number): string { let s = ''; while (n > 0) { n--; s = String.fromCharCode(65 + n % 26) + s; n = Math.floor(n / 26); } return s; }
