import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { assembleDocument, type ReportDocument } from '../src/core/index.ts';
import { ReportPage, ReportView } from '../src/site/report-view.tsx';
import { reportMeta } from '../src/site/report-meta.ts';

const text = (value: string) => ({ type: 'text' as const, text: value });
const fixture: ReportDocument = {
  format: 'docreport', schemaVersion: 1, id: 'doc_fixture', metadata: { title: '报告测试', language: 'zh-CN' },
  blocks: [{ type: 'section', id: 'sec_random', title: '建模', numbering: 'decimal', children: [
    { type: 'paragraph', id: 'p_random', content: [text('参见'), { type: 'ref', id: 'ref_random', target: 'eq_random', display: 'label' }, { type: 'cite', id: 'cite_random', targets: ['bib_random'] }, { type: 'note_ref', id: 'nr_random', target: 'note_random' }] },
    { type: 'equation', id: 'eq_random', latex: 'E=mc^2', numbered: true },
    { type: 'figure', id: 'fig_random', src: 'assets/circuit.png', alt: '电路图', caption: [text('电路结构')] },
    { type: 'table', id: 'table_random', numbered: true, caption: [text('参数表')], columns: [{ id: 'col_a' }, { id: 'col_b' }], headerRows: 1, rows: [
      { id: 'row_a', cells: [{ id: 'cell_a', colSpan: 2, blocks: [{ type: 'paragraph', id: 'p_cell_a', content: [text('表头')] }] }] },
      { id: 'row_b', cells: [{ id: 'cell_b', rowSpan: 2, blocks: [{ type: 'paragraph', id: 'p_cell_b', content: [text('合并')] }] }, { id: 'cell_c', blocks: [{ type: 'table', id: 'table_inner', numbered: false, columns: [{ id: 'col_inner' }], headerRows: 0, rows: [{ id: 'row_inner', cells: [{ id: 'cell_inner', blocks: [{ type: 'paragraph', id: 'p_inner', content: [text('嵌套值')] }] }] }] }] }] },
      { id: 'row_c', cells: [{ id: 'cell_d', blocks: [{ type: 'paragraph', id: 'p_cell_d', content: [text('末行')] }] }] },
    ] },
    { type: 'bibliography', id: 'bibliography_random' },
  ] }],
  notes: [{ id: 'note_random', blocks: [{ type: 'paragraph', id: 'p_note', content: [text('脚注正文')] }] }],
  references: [{ id: 'bib_random', text: '参考来源', url: 'https://example.com/paper' }],
};

describe('JSON 报告真实 React 渲染', () => {
  it('保留随机锚点，显示完整编号引用、MathML与资源URL', () => {
    const report = assembleDocument('content.json', { 'content.json': fixture });
    const html = renderToStaticMarkup(<ReportView report={report} assetUrl={source => `/content-files/${source}`} />);
    expect(html).not.toContain('<h1');
    expect(html).toContain('id="sec_random"');
    expect(html).toContain('href="#eq_random"');
    expect(html).toContain(report.index.eq_random!.label);
    expect(html).toContain('<math');
    expect(html).toContain('class="katex" id="eq_random"');
    expect(html.match(/id="eq_random"/g)).toHaveLength(1);
    expect(html).toContain('电路图');
    expect(html).toContain('/content-files/assets/circuit.png');
    expect(html).toContain('href="#note_random"');
    expect(html).toContain('href="#bib_random"');
    expect(html.match(/id="bib_random"/g)).toHaveLength(1);
  });

  it('跨行合并与嵌套表格不遗漏单元格内容', () => {
    const report = assembleDocument('content.json', { 'content.json': fixture });
    const html = renderToStaticMarkup(<ReportView report={report} />);
    expect(html).toContain('rowSpan="2"');
    expect(html).toContain('colSpan="2"');
    expect(html).toContain('id="cell_inner"');
    expect(html).toContain('嵌套值');
    expect(html.match(/<table /g)).toHaveLength(2);
  });

  it('组合与独立文档分别渲染同一稳定对象，编号随组合顺序变化', () => {
    const first: ReportDocument = { ...fixture, id: 'doc_first', notes: [], references: [], blocks: [{ type: 'section', id: 'sec_first', title: '前言', numbering: 'decimal', children: [{ type: 'paragraph', id: 'p_first', content: [text('先行正文')] }] }] };
    const root: ReportDocument = { ...first, id: 'doc_root', blocks: [{ type: 'include', src: 'first.json' }, { type: 'include', src: 'chapter.json' }] };
    const files = { 'root.json': root, 'first.json': first, 'chapter.json': fixture };
    const combined = assembleDocument('root.json', files);
    const alone = assembleDocument('chapter.json', files, { mode: 'standalone' });
    expect(combined.index.sec_random!.number).not.toBe(alone.index.sec_random!.number);
    const html = renderToStaticMarkup(<ReportPage entry="root.json" files={files} />);
    expect(html).toContain('先行正文');
    expect(html).toContain('id="sec_random"');
    expect(html).not.toContain('文档尚未组装');
    expect(html).not.toContain('<button');
    expect(html).not.toContain('report-export');
    expect(html).not.toContain('下载 Word');
    expect(html).not.toContain('查看 PDF');
  });

  it('校验失败定位文件；未知节点和非法公式不会静默消失', () => {
    const invalid = { ...fixture, blocks: [{ type: 'unknown', id: 'bad' }] } as unknown as ReportDocument;
    const html = renderToStaticMarkup(<ReportPage entry="bad.json" files={{ 'bad.json': invalid }} />);
    expect(html).toContain('role="alert"');
    expect(html).toContain('bad.json');
    const report = assembleDocument('content.json', { 'content.json': fixture });
    report.document.blocks = [{ type: 'equation', id: 'eq_bad', latex: '\\unknowncommand', numbered: false }];
    expect(renderToStaticMarkup(<ReportView report={report} />)).toContain('公式预览失败');
  });

  it('标题、搜索和Markdown覆盖表格、公式、脚注与文献', () => {
    const meta = reportMeta(assembleDocument('content.json', { 'content.json': fixture }));
    expect(meta.title).toBe('报告测试');
    for (const word of ['嵌套值', 'E=mc^2', '脚注正文', '参考来源']) expect(meta.searchText).toContain(word);
    expect(meta.markdown).toContain('# 报告测试');
    expect(meta.markdown).not.toContain('eq_random');
  });

  it('多图每张下面写 (a)(b)……，整个图题只写一次，引用写成图号加字母', () => {
    const document: ReportDocument = {
      format: 'docreport', schemaVersion: 1, id: 'doc_panels', metadata: { title: '多图测试', language: 'zh-CN' },
      blocks: [{ type: 'section', id: 'sec_panels', title: '结果', numbering: 'decimal', children: [
        { type: 'figure', id: 'fig_grid', columns: 3, caption: [text('六个工况的波形')], panels: ['a', 'b', 'c', 'd', 'e', 'f'].map(k => ({ id: `panel_${k}`, src: `assets/${k}.png`, alt: `工况 ${k}`, ...(k === 'b' ? { caption: [text('满载')] } : {}) })) },
        { type: 'paragraph', id: 'p_panels', content: [text('见'), { type: 'ref', id: 'ref_panel', target: 'panel_b', display: 'label' }] },
      ] }],
    };
    const html = renderToStaticMarkup(<ReportView report={assembleDocument('panels.json', { 'panels.json': document })} assetUrl={source => `/content-files/${source}`} />);
    expect(html).toContain('--report-panel-columns:3');
    expect(html.match(/<img /g)).toHaveLength(6);
    expect(html).toContain('id="panel_f"');
    expect(html).toContain('/content-files/assets/f.png');
    expect(html).toContain('(b) 满载');
    expect(html).toContain('>(f)</div>');
    expect(html.match(/<figcaption/g)).toHaveLength(1);
    expect(html).toContain('<span>图 1 </span>六个工况的波形');
    expect(html).toContain('href="#panel_b" class="report-ref">图 1(b)</a>');
    const meta = reportMeta(assembleDocument('panels.json', { 'panels.json': document }));
    expect(meta.markdown).toContain('图 1(b) 满载');
  });

  it('摘要、富文本、列表、行内公式和代码均展示，文本保持转义', () => {
    const document: ReportDocument = {
      format: 'docreport', schemaVersion: 1, id: 'doc_inline', metadata: { title: '行内测试', language: 'zh' },
      blocks: [
        { type: 'abstract', id: 'abstract_random', paragraphs: [{ type: 'paragraph', id: 'p_abstract', content: [text('摘要内容')] }], keywords: ['测试', '协议'] },
        { type: 'paragraph', id: 'p_marks', content: [{ type: 'text', text: '<script>', marks: ['strong', 'em', 'code'] }, { type: 'math', id: 'math_random', latex: 'x^2' }, { type: 'break' }, { type: 'link', id: 'link_random', href: 'https://example.com', text: '来源页面' }] },
        { type: 'list', id: 'list_random', ordered: true, start: 3, items: [{ id: 'li_random', blocks: [{ type: 'paragraph', id: 'p_list', content: [text('列表正文')] }] }] },
        { type: 'code', id: 'code_random', language: 'python', text: 'print("ok")' },
      ],
    };
    const html = renderToStaticMarkup(<ReportView report={assembleDocument('inline.json', { 'inline.json': document })} />);
    expect(html).toContain('摘要内容');
    expect(html).toContain('关键词：');
    expect(html).toContain('<code><em><strong>&lt;script&gt;');
    expect(html).toContain('class="katex" id="math_random"');
    expect(html).toContain('start="3"');
    expect(html).toContain('id="li_random"');
    expect(html).toContain('print(&quot;ok&quot;)');
  });
});
