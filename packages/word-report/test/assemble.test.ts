import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { assembleDocument, parseReportJson, validateDocument, type ReportDocument, type ReportBlock } from '../src/core/index.ts';
const paragraph = (id: string, text = '正文') => ({ type: 'paragraph' as const, id, content: [{ type: 'text' as const, text }] });
const section = (id: string, children: ReportBlock[] = [paragraph(`${id}_p`)]) => ({ type: 'section' as const, id, title: id, numbering: 'decimal' as const, children });
const doc = (id: string, blocks: ReportDocument['blocks'] = [section(`${id}_sec`)]): ReportDocument => ({ format: 'docreport', schemaVersion: 1, id, metadata: { title: id, language: 'zh-CN' }, blocks });
const include = (src: string) => ({ type: 'include' as const, src });
const root = () => doc('root', [include('a/content.json'), include('b/content.json')]);

describe('isomorphic report assembly', () => {
  it('accepts the committed Word baseline without dropping semantic content', () => {
    const text = readFileSync(new URL('./fixtures/word-demo.json', import.meta.url), 'utf8');
    const input = JSON.parse(text) as ReportDocument;
    const result = assembleDocument('content.json', { 'content.json': text });
    expect(result.document.blocks.length).toBe(input.blocks.length);
    expect(result.document.metadata).toEqual(input.metadata);
    expect(result.document.notes).toEqual(input.notes ?? []);
    expect(result.document.references).toEqual(input.references ?? []);
    const shapes = (value: unknown): string[] => {
      if (Array.isArray(value)) return value.flatMap(shapes);
      if (value && typeof value === 'object') return [Object.hasOwn(value, 'type') ? String((value as any).type) : '', ...Object.values(value).flatMap(shapes)];
      return [];
    };
    expect(shapes(result.document)).toEqual(shapes(input));
  });
  it('exports chapters alone and in a composite with stable identities and numbering', () => {
    const a = doc('a', [section('sa', [{ type: 'equation', id: 'eq_a', latex: 'x=1', numbered: true }])]);
    const b = doc('b', [section('sb', [{ type: 'equation', id: 'eq_b', latex: 'y=2', numbered: true }])]);
    const files = { 'content.json': root(), 'a/content.json': a, 'b/content.json': b };
    const result = assembleDocument('content.json', files);
    expect(result.index.eq_b!.number).toBe('2-1');
    expect(assembleDocument('b/content.json', files).index.eq_b!.number).toBe('1-1');
    expect(result.sources.eq_b).toEqual({ file: 'b/content.json', pointer: '/blocks/0/children/0' });
    validateDocument(result.document);
    expect(assembleDocument('combined.json', { 'combined.json': result.document }).index.eq_b!.number).toBe('2-1');
    expect(b.blocks[0]).toEqual(section('sb', [{ type: 'equation', id: 'eq_b', latex: 'y=2', numbered: true }]));
    files['content.json'].blocks.reverse();
    expect(assembleDocument('content.json', files).index.eq_b!.number).toBe('1-1');
  });
  it('resolves cross-chapter references; standalone only converts explicit external references', () => {
    const a = doc('a', [section('sa', [{ type: 'equation', id: 'target', latex: 'x', numbered: true }])]);
    const b = doc('b', [section('sb', [{ type: 'paragraph', id: 'p', content: [{ type: 'ref', id: 'ref', target: 'target', display: 'label', externalLabel: '建模章中的公式' }] }])]);
    const files = { 'content.json': root(), 'a/content.json': a, 'b/content.json': b };
    expect(assembleDocument('content.json', files).index.target!.label).toBe('式（1-1）');
    expect(() => assembleDocument('b/content.json', files)).toThrow('Unknown reference target');
    const standalone = assembleDocument('b/content.json', files, { mode: 'standalone' });
    expect(standalone.warnings).toHaveLength(1);
    expect(JSON.stringify(standalone.document)).toContain('建模章中的公式');
    expect(JSON.stringify(standalone.document)).not.toContain('externalLabel');
    const missing = doc('missing', [section('s', [{ type: 'paragraph', id: 'p', content: [{ type: 'ref', id: 'r', target: 'gone', display: 'label' }] }])]);
    expect(() => assembleDocument('x.json', { 'x.json': missing }, { mode: 'standalone' })).toThrow('Unknown reference target');
  });
  it('namespaces identically named chapter images', () => {
    const figure = (id: string) => ({ type: 'figure' as const, id, src: 'assets/image.png', alt: '图', caption: [{ type: 'text' as const, text: '示意图' }] });
    const result = assembleDocument('content.json', { 'content.json': root(), 'a/content.json': doc('a', [section('sa', [figure('fa')])]), 'b/content.json': doc('b', [section('sb', [figure('fb')])]) });
    expect(result.assets).toEqual({ 'assets/a/image.png': 'a/assets/image.png', 'assets/b/image.png': 'b/assets/image.png' });
  });
  it('numbers multi-image figure panels by their written labels and resolves references to a panel', () => {
    const panel = (id: string, file: string, row: number, column: number, label: string) => ({ id, row, column, label, src: `assets/${file}`, alt: id, caption: [{ type: 'text' as const, text: `${id} 小标题` }] });
    const multi = { type: 'figure' as const, id: 'grid', rows: 2, columns: 2, panels: [panel('pa', 'a.png', 2, 2, 'a'), panel('pb', 'b.png', 1, 1, 'b'), panel('pc', 'c.png', 1, 2, 'c')], caption: [{ type: 'text' as const, text: '三张图' }] };
    const single = { type: 'figure' as const, id: 'one', src: 'assets/one.png', alt: '图', caption: [{ type: 'text' as const, text: '单张' }] };
    const ref = (id: string, target: string, display: 'label' | 'number' | 'title') => ({ type: 'ref' as const, id, target, display });
    const input = doc('d', [section('s', [single, multi, { type: 'paragraph', id: 'p', content: [ref('r1', 'pb', 'label'), ref('r2', 'pc', 'number'), ref('r3', 'pa', 'title'), ref('r4', 'grid', 'label')] }])]);
    const result = assembleDocument('x.json', { 'x.json': input });
    expect(result.index.grid!.label).toBe('图 2');
    expect(result.index.pb).toEqual({ type: 'figure-panel', number: '2(b)', label: '图 2(b)', title: 'pb 小标题' });
    expect(result.index.pc!.number).toBe('2(c)');
    expect(Object.keys(result.assets).sort()).toEqual(['assets/d/a.png', 'assets/d/b.png', 'assets/d/c.png', 'assets/d/one.png']);
  });
  it('leaves cells that no panel names empty', () => {
    const figure = { type: 'figure' as const, id: 'grid', rows: 2, columns: 3, caption: [{ type: 'text' as const, text: '图题' }], panels: [{ id: 'pa', row: 1, column: 1, label: 'a', src: 'assets/a.png', alt: 'a' }, { id: 'pb', row: 2, column: 3, label: 'b', src: 'assets/b.png', alt: 'b' }] };
    expect(assembleDocument('x.json', { 'x.json': doc('d', [section('s', [figure])]) }).index.pb!.label).toBe('图 1(b)');
  });
  it.each([
    ['panels together with src', (f: any) => { f.src = 'assets/x.png'; }, 'Disallowed'],
    ['panels without rows', (f: any) => { delete f.rows; }, 'Missing rows'],
    ['more than six columns', (f: any) => { f.columns = 7; }, 'Maximum is 6'],
    ['a single panel', (f: any) => { f.panels = f.panels.slice(0, 1); }, 'At least 2'],
    ['a duplicate panel id', (f: any) => { f.panels[1].id = 'pa'; }, 'Duplicate ID'],
    ['a panel without a position', (f: any) => { delete f.panels[1].column; }, 'Missing column'],
    ['a panel without a label', (f: any) => { delete f.panels[1].label; }, 'Missing label'],
    ['a label written with parentheses', (f: any) => { f.panels[1].label = '(b)'; }, 'pattern'],
    ['a panel outside the grid', (f: any) => { f.panels[1].row = 2; }, 'outside the 1 x 2 grid'],
    ['two panels in one cell', (f: any) => { f.panels[1].column = 1; }, 'shares row 1, column 1 with pa'],
    ['a repeated label', (f: any) => { f.panels[1].label = 'a'; }, 'label (a) is also used by pa'],
  ])('rejects a multi-image figure with %s', (_name, mutate, error) => {
    const figure = { type: 'figure', id: 'grid', rows: 1, columns: 2, caption: [{ type: 'text', text: '图题' }], panels: [{ id: 'pa', row: 1, column: 1, label: 'a', src: 'assets/a.png', alt: 'a' }, { id: 'pb', row: 1, column: 2, label: 'b', src: 'assets/b.png', alt: 'b' }] };
    mutate(figure);
    expect(() => assembleDocument('x.json', { 'x.json': doc('d', [section('s', [figure as any])]) })).toThrow(error);
  });
  it('rejects a grid size on a single-image figure', () => {
    const figure = { type: 'figure', id: 'one', src: 'assets/one.png', alt: '图', rows: 1, caption: [{ type: 'text', text: '单张' }] };
    expect(() => assembleDocument('x.json', { 'x.json': doc('d', [section('s', [figure as any])]) })).toThrow('Disallowed');
  });
  it('uses only root template metadata and allows common child field names', () => {
    const a = doc('a'), b = doc('b');
    a.metadata.fields = [{ id: 'course', label: '课程', value: 'A' }]; b.metadata.fields = [{ id: 'course', label: '课程', value: 'B' }];
    expect(assembleDocument('content.json', { 'content.json': root(), 'a/content.json': a, 'b/content.json': b }).document.metadata.title).toBe('root');
  });
  it('collects matching bibliography entries and preserves the root placement', () => {
    const a = doc('a', [section('sa'), { type: 'bibliography', id: 'bib_a' }]);
    const b = doc('b', [section('sb'), { type: 'bibliography', id: 'bib_b' }]);
    a.references = [{ id: 'book', text: 'Book', url: 'https://example.com' }]; b.references = [{ id: 'book', url: 'https://example.com', text: 'Book' }];
    const main = root(); main.blocks.splice(1, 0, { type: 'bibliography', id: 'main_bib' });
    const result = assembleDocument('content.json', { 'content.json': main, 'a/content.json': a, 'b/content.json': b });
    expect(result.document.references).toHaveLength(1);
    expect(result.document.blocks.map(x => x.type)).toEqual(['section', 'bibliography', 'section']);
    const auto = assembleDocument('content.json', { 'content.json': root(), 'a/content.json': a, 'b/content.json': b });
    expect(auto.document.blocks.at(-1)?.type).toBe('bibliography');
    b.references![0]!.text = 'Other';
    expect(() => assembleDocument('content.json', { 'content.json': root(), 'a/content.json': a, 'b/content.json': b })).toThrow('Conflicting bibliography entry');
  });
  it('reads citations in note reading order and enforces one use per note', () => {
    const input = doc('d', [section('s', [{ type: 'paragraph', id: 'p', content: [{ type: 'note_ref', id: 'nr', target: 'note' }, { type: 'cite', id: 'c', targets: ['r2'] }] }])]);
    input.notes = [{ id: 'note', blocks: [{ type: 'paragraph', id: 'np', content: [{ type: 'cite', id: 'nc', targets: ['r1'] }] }] }];
    input.references = [{ id: 'r2', text: 'Two' }, { id: 'r1', text: 'One' }];
    const result = assembleDocument('x.json', { 'x.json': input });
    expect(result.index.r1!.number).toBe('1'); expect(result.index.r2!.number).toBe('2'); expect(result.index.note!.number).toBe('1');
    input.notes.push({ id: 'unused', blocks: [paragraph('up')] });
    expect(() => assembleDocument('x.json', { 'x.json': input })).toThrow('exactly one');
  });
  it('checks nested table grids independently and formula chapter context', () => {
    const table = { type: 'table' as const, id: 'table', numbered: false, columns: [{ id: 'col' }], headerRows: 0, rows: [{ id: 'row', cells: [{ id: 'cell', blocks: [] }] }] };
    const input = doc('d', [section('s', [table])]);
    expect(assembleDocument('x.json', { 'x.json': input }).document.blocks).toHaveLength(1);
    table.rows[0]!.cells = [];
    expect(() => assembleDocument('x.json', { 'x.json': input })).toThrow('uncovered');
    expect(() => assembleDocument('x.json', { 'x.json': doc('d', [{ type: 'equation', id: 'eq', numbered: true, latex: 'x' }]) })).toThrow('outside');
  });
  it('accepts nested tables with merged cells and rejects boundary overlaps', () => {
    const nested = { type: 'table' as const, id: 'nested', numbered: false, columns: [{ id: 'nc' }], headerRows: 0, rows: [{ id: 'nr', cells: [{ id: 'nn', blocks: [paragraph('nested_p')] }] }] };
    const table = { type: 'table' as const, id: 'table', numbered: false, columns: [{ id: 'c1' }, { id: 'c2' }], headerRows: 0, rows: [{ id: 'r1', cells: [{ id: 'cell1', colSpan: 2, blocks: [nested] }] }, { id: 'r2', cells: [{ id: 'cell2', colSpan: 2, blocks: [] }] }] };
    const input = doc('d', [section('s', [table])]);
    expect(assembleDocument('x.json', { 'x.json': input }).index.nested!.type).toBe('table');
    table.rows[0]!.cells[0]!.colSpan = 3;
    expect(() => assembleDocument('x.json', { 'x.json': input })).toThrow('out of bounds');
    table.rows[0]!.cells[0]!.colSpan = 2; table.headerRows = 1;
    (table.rows[0]!.cells[0] as any).rowSpan = 2;
    expect(() => assembleDocument('x.json', { 'x.json': input })).toThrow('header boundary');
  });
  it('numbers appendix descendants while rejecting a later main chapter', () => {
    const appendix = section('app', [section('sub')]); appendix.numbering = 'appendix' as any;
    const input = doc('d', [section('main'), appendix]);
    const result = assembleDocument('x.json', { 'x.json': input });
    expect(result.index.app!.number).toBe('A'); expect(result.index.sub!.number).toBe('A.1');
    input.blocks.push(section('late'));
    expect(() => assembleDocument('x.json', { 'x.json': input })).toThrow('after appendix');
  });
  it('rejects multiple abstracts instead of silently discarding content', () => {
    const abstract = (id: string) => ({ type: 'abstract' as const, id, paragraphs: [paragraph(id + '_p')], keywords: ['词'] });
    expect(() => assembleDocument('content.json', { 'content.json': root(), 'a/content.json': doc('a', [abstract('aa'), section('sa')]), 'b/content.json': doc('b', [abstract('ab'), section('sb')]) })).toThrow('Multiple abstracts');
  });
  it.each([
    ['unknown field', (d: any) => { d.unrecognized = true; }, 'Unknown field'],
    ['unknown node', (d: any) => { d.blocks = [{ type: 'mystery' }]; }, 'Unsupported'],
    ['bad version', (d: any) => { d.schemaVersion = 2; }, 'Expected 1'],
    ['bad date', (d: any) => { d.metadata.date = '2026-02-30'; }, 'calendar date'],
    ['duplicate ID', (d: any) => { d.blocks[0].children.push(paragraph('d_sec_p')); }, 'Duplicate ID'],
    ['non-ASCII formula', (d: any) => { d.blocks[0].children.push({ type: 'equation', id: 'e', latex: '中文', numbered: true }); }, 'ASCII'],
    ['manual formula tag', (d: any) => { d.blocks[0].children.push({ type: 'equation', id: 'e', latex: 'x\\tag{1}', numbered: true }); }, 'manual numbering'],
    ['nested include', (d: any) => { d.blocks[0].children = [include('a.json')]; }, 'Unsupported'],
    ['path traversal', (d: any) => { d.blocks = [include('../other.json')]; }, 'Invalid relative path'],
  ])('rejects %s', (_name, mutate, error) => {
    const input = doc('d'); mutate(input);
    expect(() => assembleDocument('x.json', { 'x.json': input })).toThrow(error);
  });
  it('rejects circular, repeated and missing includes', () => {
    expect(() => assembleDocument('x.json', { 'x.json': doc('x', [include('x.json')]) })).toThrow('Circular');
    expect(() => assembleDocument('x.json', { 'x.json': doc('x', [include('a.json'), include('a.json')]), 'a.json': doc('a') })).toThrow('Repeated');
    expect(() => assembleDocument('x.json', { 'x.json': doc('x', [include('gone.json')]) })).toThrow('Missing');
  });
});
describe('strict JSON parsing', () => {
  it.each(['{"id":"a","id":"b"}', '{"x":{"text":"a","text":"b"}}', '{"id":"a","\\u0069d":"b"}'])('rejects duplicate keys %s', text => expect(() => parseReportJson(text)).toThrow('Duplicate JSON key'));
  it.each(['NaN', '1e999', '[1,]', '{}x', '\u00a0{}', '{"x":1,}'])('rejects non-JSON input %s', text => expect(() => parseReportJson(text)).toThrow());
});
