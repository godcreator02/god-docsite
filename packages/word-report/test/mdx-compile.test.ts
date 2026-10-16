import { describe, expect, it } from 'vitest';
import { assembleMdxReport, compileMdxReport, mdxReportInputsOf, ReportContentError, type ReportDocument } from '../src/core/index.ts';

const index = (body = '', frontmatter = 'title: 示例报告\nlanguage: zh-CN\nchapters: [c1.mdx]') => `---\n${frontmatter}\n---\n\n${body}`;
const compile = (files: Record<string, string>, reportId = 'demo') => compileMdxReport({ reportId, entry: 'reports/demo/index.mdx', files: Object.fromEntries(Object.entries(files).map(([name, text]) => [`reports/demo/${name}`, text])) });
const chapter = (body: string) => compile({ 'index.mdx': index(), 'c1.mdx': body }).document;
const firstSection = (document: ReportDocument) => document.blocks[0] as Extract<ReportDocument['blocks'][number], { type: 'section' }>;
const errorOf = (run: () => unknown): ReportContentError => {
  try { run(); } catch (error) { if (error instanceof ReportContentError) return error; throw error; }
  throw new Error('没有报错');
};
const withoutIds = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map(withoutIds);
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).filter(([key]) => key !== 'id').map(([key, child]) => [key, withoutIds(child)]));
  return value;
};

describe('MDX 报告的文件头与分章', () => {
  it('入口文件头写元数据，章按 chapters 的顺序接在入口正文后面', () => {
    const result = compile({
      'index.mdx': index('<Abstract keywords="固态变压器；双有源桥">\n\n摘要正文。\n\n</Abstract>', 'title: 示例报告\nlanguage: zh-CN\nrevision: V0.1\ndate: 2026-10-17\nfields:\n  - { id: subject, label: 主题, value: 测试 }\nchapters: [c2.mdx, c1.mdx]'),
      'c1.mdx': '# 第二章\n\n正文二。',
      'c2.mdx': '# 第一章\n\n正文一。',
    });
    expect(result.document.metadata).toEqual({ title: '示例报告', language: 'zh-CN', revision: 'V0.1', date: '2026-10-17', fields: [{ id: 'subject', label: '主题', value: '测试' }] });
    expect(result.document.blocks.map((block) => block.type === 'section' ? block.title : block.type)).toEqual(['abstract', '第一章', '第二章']);
    expect(result.document.blocks[0]).toMatchObject({ type: 'abstract', keywords: ['固态变压器', '双有源桥'], paragraphs: [{ content: [{ type: 'text', text: '摘要正文。' }] }] });
    expect(result.files).toEqual(['reports/demo/index.mdx', 'reports/demo/c2.mdx', 'reports/demo/c1.mdx']);
    expect(mdxReportInputsOf(index(), 'reports/demo/index.mdx')).toEqual({ chapters: ['reports/demo/c1.mdx'], references: 'reports/demo/references.mdx' });
  });
  it('章文件头的 numbering 管一级标题，下级跟着上级', () => {
    const appendix = compile({ 'index.mdx': index(), 'c1.mdx': '---\nnumbering: appendix\n---\n\n# 附录\n\n## 小节\n\n正文。' }).document;
    expect(firstSection(appendix)).toMatchObject({ numbering: 'appendix', children: [{ type: 'section', numbering: 'decimal' }] });
    const none = compile({ 'index.mdx': index(), 'c1.mdx': '---\nnumbering: none\n---\n\n# 结语\n\n## 小节\n\n正文。' }).document;
    expect(firstSection(none)).toMatchObject({ numbering: 'none', children: [{ type: 'section', numbering: 'none' }] });
  });
  it.each([
    ['index.mdx 没有文件头', { 'index.mdx': '正文' }, 'index.mdx 要有文件头'],
    ['文件头认不出的键', { 'index.mdx': index('', 'title: a\nlanguage: zh-CN\nauthor: x') }, '认不出「author」'],
    ['章文件带目录', { 'index.mdx': index('', 'title: a\nlanguage: zh-CN\nchapters: [sub/c1.mdx]') }, '不带目录'],
    ['章文件不存在', { 'index.mdx': index() }, '找不到这个文件'],
    ['章文件头写错 numbering', { 'index.mdx': index(), 'c1.mdx': '---\nnumbering: roman\n---\n\n# 章\n\n正文' }, 'numbering 只能是'],
  ])('%s直接报错', (_name, files, message) => {
    expect(errorOf(() => compile(files as Record<string, string>)).message).toContain(message);
  });
  it('报告目录名不以字母开头时不能当文档 id', () => {
    expect(errorOf(() => compile({ 'index.mdx': index(), 'c1.mdx': '# 章\n\n正文' }, '2026-report')).message).toContain('要以字母开头');
  });
});

describe('MDX 块与行内', () => {
  it('标题建节，[#id] 给节固定 id 且不留在标题里，标题跳级报错', () => {
    const document = chapter('# 概述 [#c1]\n\n## 背景\n\n正文。');
    expect(firstSection(document)).toMatchObject({ id: 'c1', title: '概述', children: [{ type: 'section', title: '背景' }] });
    expect(errorOf(() => chapter('# 概述\n\n### 跳级\n\n正文')).message).toContain('标题跳级');
    expect(errorOf(() => chapter('## 开头就是二级\n\n正文')).message).toContain('要写成一级标题');
    expect(errorOf(() => chapter('# 有 $x$ 的标题\n\n正文')).message).toContain('标题里只能写文字');
  });
  it('段落里的文字、标记、行内公式、引用、链接与换行', () => {
    const document = chapter('# 章\n\n电压 $V_{C1}$ 见 <Ref to="fig-a" />，**加粗**、*斜体*、`代码`、H<sub>2</sub>O、<Cite to="ref-a ref-b" />，[链接](https://example.com)。<br />下一行\n\n<Figure id="fig-a" src="assets/a.png">图题</Figure>');
    const content = (firstSection(document).children[0] as { content: unknown[] }).content;
    expect(withoutIds(content)).toEqual([
      { type: 'text', text: '电压 ' }, { type: 'math', latex: 'V_{C1}' }, { type: 'text', text: ' 见 ' }, { type: 'ref', target: 'fig-a', display: 'label' },
      { type: 'text', text: '，' }, { type: 'text', text: '加粗', marks: ['strong'] }, { type: 'text', text: '、' }, { type: 'text', text: '斜体', marks: ['em'] },
      { type: 'text', text: '、' }, { type: 'text', text: '代码', marks: ['code'] }, { type: 'text', text: '、H' }, { type: 'text', text: '2', marks: ['sub'] },
      { type: 'text', text: 'O、' }, { type: 'cite', targets: ['ref-a', 'ref-b'] }, { type: 'text', text: '，' }, { type: 'link', text: '链接', href: 'https://example.com' },
      { type: 'text', text: '。' }, { type: 'break' }, { type: 'text', text: '下一行' },
    ]);
  });
  it('软换行两侧都是中文时直接连上，否则换成空格；嵌套的标记取并集', () => {
    const content = (firstSection(chapter('# 章\n\n中文\n接着写，English\nwords，**<sub>x</sub>**')).children[0] as { content: unknown[] }).content;
    expect(withoutIds(content)).toEqual([{ type: 'text', text: '中文接着写，English words，' }, { type: 'text', text: 'x', marks: ['strong', 'sub'] }]);
  });
  it('编号公式写 ```math，可带 id；$$ 公式不编号；其余代码块照语言名', () => {
    const children = firstSection(chapter('# 章\n\n```math eq-p\nP = \\frac{a}{b}\n```\n\n```math\nx = 1\n```\n\n$$\ny = 2\n$$\n\n```ts\nconst a = 1\n```\n\n```\n纯文字\n```')).children;
    expect(withoutIds(children)).toEqual([
      { type: 'equation', latex: 'P = \\frac{a}{b}', numbered: true }, { type: 'equation', latex: 'x = 1', numbered: true }, { type: 'equation', latex: 'y = 2', numbered: false },
      { type: 'code', language: 'ts', text: 'const a = 1' }, { type: 'code', language: 'text', text: '纯文字' },
    ]);
    expect(children[0]!.id).toBe('eq-p');
  });
  it('图：图题里能有公式与文献引用，不写 alt 时取图题的纯文字', () => {
    const [figure] = firstSection(chapter('# 章\n\n<Figure src="assets/a.png">\n  单元电压 $V_{C1}$ 的波形 <Cite to="ref-a" />\n</Figure>')).children;
    expect(withoutIds(figure)).toEqual({ type: 'figure', src: 'assets/a.png', alt: '单元电压 $V_{C1}$ 的波形', caption: [{ type: 'text', text: '单元电压 ' }, { type: 'math', latex: 'V_{C1}' }, { type: 'text', text: ' 的波形 ' }, { type: 'cite', targets: ['ref-a'] }] });
  });
  it('多图：一个 Caption 加若干 Panel，行列与编号照写', () => {
    const [figure] = firstSection(chapter('# 章\n\n<Figures id="fig-w" rows="1" columns="2">\n  <Caption>两种工况</Caption>\n  <Panel row="1" column="1" label="a" src="assets/a.png">轻载</Panel>\n  <Panel id="fig-w-b" row="1" column="2" label="b" src="assets/b.png" alt="满载电流" />\n</Figures>')).children;
    expect(figure).toMatchObject({ id: 'fig-w', rows: 1, columns: 2, caption: [{ text: '两种工况' }], panels: [{ row: 1, column: 1, label: 'a', alt: '轻载', caption: [{ text: '轻载' }] }, { id: 'fig-w-b', label: 'b', alt: '满载电流' }] });
  });
  it('表：<Table> 里的 GFM 表格编号，表格单元格里能写公式；不在 <Table> 里的 GFM 表格不编号', () => {
    const children = firstSection(chapter('# 章\n\n<Table id="tbl-p">\n  <Caption>参数</Caption>\n\n| 参数 | 值 |\n| --- | --- |\n| $V_{C1}$ | 1.6 kV |\n\n</Table>\n\n| a | b |\n| - | - |\n| 1 | |')).children;
    expect(children[0]).toMatchObject({ type: 'table', id: 'tbl-p', numbered: true, headerRows: 1, caption: [{ text: '参数' }] });
    expect(withoutIds((children[0] as { rows: unknown[] }).rows[1])).toEqual({ cells: [{ blocks: [{ type: 'paragraph', content: [{ type: 'math', latex: 'V_{C1}' }] }] }, { blocks: [{ type: 'paragraph', content: [{ type: 'text', text: '1.6 kV' }] }] }] });
    expect(children[1]).toMatchObject({ type: 'table', numbered: false, headerRows: 1 });
    expect((children[1] as { caption?: unknown }).caption).toBeUndefined();
    expect((children[1] as { rows: { cells: { blocks: unknown[] }[] }[] }).rows[1]!.cells[1]!.blocks).toMatchObject([{ type: 'paragraph', content: [] }]);
  });
  it('有合并单元格的表写小写 <table>：开头全是 th 的行是表头', () => {
    const [table] = firstSection(chapter('# 章\n\n<Table>\n  <Caption>合并</Caption>\n  <table>\n    <tr><th colSpan="2">表头</th></tr>\n    <tr><td rowSpan="2">左</td><td>$x$</td></tr>\n    <tr><td>右下</td></tr>\n  </table>\n</Table>')).children;
    expect(table).toMatchObject({ type: 'table', numbered: true, headerRows: 1, columns: [{}, {}], rows: [{ cells: [{ colSpan: 2 }] }, { cells: [{ rowSpan: 2 }, { blocks: [{ content: [{ type: 'math', latex: 'x' }] }] }] }, { cells: [{}] }] });
  });
  it('列表、脚注与文献列表', () => {
    const result = compile({
      'index.mdx': index(),
      'c1.mdx': '# 章\n\n3. 第三\n4. 第四\n\n- 甲\n  - 乙\n\n正文[^n1]。\n\n[^n1]: 脚注内容。',
      'references.mdx': '<Reference id="ref-a" url="https://example.com/a">作者. 题名[J]. 刊名, 2026.</Reference>\n\n<Reference id="ref-b">作者. 书名[M]. 出版社, 2025.</Reference>',
    });
    const children = firstSection(result.document).children;
    expect(children[0]).toMatchObject({ type: 'list', ordered: true, start: 3 });
    expect(children[1]).toMatchObject({ type: 'list', ordered: false, items: [{ blocks: [{ type: 'paragraph' }, { type: 'list' }] }] });
    expect(children[2]).toMatchObject({ content: [{ text: '正文' }, { type: 'note_ref', target: 'n1' }, { text: '。' }] });
    expect(result.document.notes).toMatchObject([{ id: 'n1', blocks: [{ content: [{ text: '脚注内容。' }] }] }]);
    expect(result.document.references).toEqual([{ id: 'ref-a', text: '作者. 题名[J]. 刊名, 2026.', url: 'https://example.com/a' }, { id: 'ref-b', text: '作者. 书名[M]. 出版社, 2025.' }]);
    expect(result.files.at(-1)).toBe('reports/demo/references.mdx');
  });
  it('纯注释的表达式忽略', () => {
    expect(withoutIds(firstSection(chapter('# 章\n\n{/* 待核验 */}\n\n正文{/* 行内注释 */}。')).children)).toEqual([{ type: 'paragraph', content: [{ type: 'text', text: '正文。' }] }]);
  });
});

describe('MDX 写错时报错，带文件与行列', () => {
  it.each([
    ['import', 'import X from "./x"\n\n# 章\n\n正文', '不写 import'],
    ['表达式', '# 章\n\n正文 {1 + 1}', '不能写 {…} 表达式'],
    ['Markdown 图片', '# 章\n\n![图](assets/a.png)', '<Figure'],
    ['引用块', '# 章\n\n> 引用', '不支持引用块'],
    ['认不出的组件', '# 章\n\n<Chart />', '认不出组件 <Chart>'],
    ['组件属性写成表达式', '# 章\n\n<Figure src={x}>图</Figure>', '要写成字符串'],
    ['组件没列的属性', '# 章\n\n<Figure src="assets/a.png" width="80">图</Figure>', '没有属性 width'],
    ['缺必填属性', '# 章\n\n<Figure>图</Figure>', '缺少属性 src'],
    ['Figure 写在一段文字中间', '# 章\n\n前文 <Figure src="assets/a.png">图</Figure>', '要单独成段'],
    ['Caption 在外面', '# 章\n\n<Caption>表题</Caption>', '只能写在 <Table> 或 <Figures> 里'],
    ['Abstract 写在章里', '# 章\n\n<Abstract keywords="a">\n\n摘要\n\n</Abstract>', '只能写在 index.mdx'],
    ['Reference 写在章里', '# 章\n\n<Reference id="r">文</Reference>', 'references.mdx'],
    ['手写 auto- 开头的 id', '# 章 [#auto-sec-1]\n\n正文', '以 auto- 开头'],
    ['id 不合规则', '# 章\n\n<Figure id="1fig" src="assets/a.png">图</Figure>', '不合规则'],
    ['$$ 带 id', '# 章\n\n$$ eq\nx\n$$', '不编号、不写 id'],
    ['Ref 的 show 写错', '# 章\n\n见 <Ref to="a" show="page" />', 'show 只能是'],
    ['列表项里放图', '# 章\n\n- <Figure src="assets/a.png">图</Figure>', '列表项里不能放图'],
    ['裸的小于号', '# 章\n\n电压 <1 kV', 'MDX 语法错误'],
  ])('%s', (_name, body, message) => {
    const error = errorOf(() => chapter(body));
    expect(error.message).toContain(message);
    expect(error.file).toBe('reports/demo/c1.mdx');
    expect(error.pointer).toMatch(/^\d+:\d+$/);
  });
});

describe('生成的 id', () => {
  it('同一份内容每次编译 id 相同，内容重复的加 -2，改了字 id 才变；节只看标题', () => {
    const body = '# 章\n\n同一句。\n\n同一句。\n\n另一句。';
    const ids = (document: ReportDocument) => firstSection(document).children.map((child) => child.id);
    const first = ids(chapter(body));
    expect(first[0]).toMatch(/^auto-p-[0-9a-z]+$/);
    expect(first[1]).toBe(`${first[0]}-2`);
    expect(ids(chapter(body))).toEqual(first);
    expect(ids(chapter(body.replace('另一句', '改过的一句')))[2]).not.toBe(first[2]);
    expect(firstSection(chapter('# 章\n\n甲')).id).toBe(firstSection(chapter('# 章\n\n乙')).id);
  });
});

describe('组装：错误位置换回 MDX', () => {
  const input = (body: string, references = '') => ({ reportId: 'demo', entry: 'reports/demo/index.mdx', files: { 'reports/demo/index.mdx': index(), 'reports/demo/c1.mdx': body, ...(references ? { 'reports/demo/references.mdx': references } : {}) } });
  it('编号与引用照常算，sources 指向 MDX 行列', () => {
    const result = assembleMdxReport(input('# 章 [#c1]\n\n见 <Ref to="fig-a" />。\n\n<Figure id="fig-a" src="assets/a.png">图题</Figure>'));
    expect(result.index['fig-a']).toMatchObject({ label: '图 1-1' });
    expect(result.sources['fig-a']).toEqual({ file: 'reports/demo/c1.mdx', pointer: '5:1' });
    expect(result.sources['c1']).toEqual({ file: 'reports/demo/c1.mdx', pointer: '1:1' });
    expect(result.dependencies).toEqual(['reports/demo/index.mdx', 'reports/demo/c1.mdx']);
  });
  it('引用不存在的 id、重复 id、文献引用找不到，都报在 MDX 的位置上', () => {
    const missing = errorOf(() => assembleMdxReport(input('# 章\n\n正文。\n\n见 <Ref to="fig-x" />。')));
    expect(missing.message).toContain('Unknown reference target: fig-x');
    expect([missing.file, missing.pointer]).toEqual(['reports/demo/c1.mdx', '5:3']);
    const duplicate = errorOf(() => assembleMdxReport(input('# 章 [#same]\n\n## 节 [#same]\n\n正文')));
    expect(duplicate.message).toContain('Duplicate ID: same');
    expect(duplicate.file).toBe('reports/demo/c1.mdx');
    const cite = errorOf(() => assembleMdxReport(input('# 章\n\n正文 <Cite to="ref-x" />', '<Reference id="ref-a">文献</Reference>')));
    expect(cite.message).toContain('Unknown bibliography entry: ref-x');
    expect([cite.file, cite.pointer]).toEqual(['reports/demo/c1.mdx', '3:4']);
  });
  it('图写在章外直接报错（照 JSON 报告的编号规则）', () => {
    const outside = errorOf(() => assembleMdxReport({ ...input(''), files: { 'reports/demo/index.mdx': index('<Figure src="assets/a.png">图</Figure>', 'title: a\nlanguage: zh-CN') } }));
    expect(outside.message).toContain('outside a numbered chapter');
    expect([outside.file, outside.pointer]).toEqual(['reports/demo/index.mdx', '6:1']);
  });
});
