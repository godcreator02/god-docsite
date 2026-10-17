import type { CellBlock, Equation, Figure, FigurePanel, Paragraph, ReportBlock, ReportInline, ReportList, Section, Table, TableCell } from '../types.ts';
import { failAt, isCommentOnlyExpression, located, type CompileContext, type MdastNode } from './context.ts';
import { explicitIdOf } from './ids.ts';
import { BLOCK_COMPONENTS, inlinesOf, plainTextOf, unknownComponentMessage } from './inline.ts';
import { attributesOf, elementChildrenOf, phrasingChildrenOf, positiveIntegerOf } from './jsx.ts';
import { positionOf } from './parse.ts';

/** 块出现的位置决定能放哪几种块：照 docreport 各容器的类型 */
export type BlockPlace = 'top' | 'listItem' | 'cell' | 'note' | 'abstract';
type AnyBlock = ReportBlock | { type: 'abstract' } & Record<string, unknown>;

const ALLOWED_BLOCKS: Record<BlockPlace, ReadonlySet<string>> = {
  top: new Set(['paragraph', 'list', 'figure', 'table', 'equation', 'code', 'bibliography', 'abstract']),
  listItem: new Set(['paragraph', 'list']),
  cell: new Set(['paragraph', 'list', 'figure', 'table', 'equation', 'code']),
  note: new Set(['paragraph', 'list', 'code']),
  abstract: new Set(['paragraph']),
};

const BLOCK_NAMES: Record<string, string> = {
  paragraph: '段落', list: '列表', figure: '图', table: '表', equation: '公式', code: '代码块', bibliography: '<WordBibliography />', abstract: '<WordAbstract>',
};
const PLACE_NAMES: Record<BlockPlace, string> = { top: '正文', listItem: '列表项', cell: '表格单元格', note: '脚注', abstract: '<WordAbstract>' };

const explicitOrRequested = <T extends { id: string }>(context: CompileContext, node: T, rawId: string | undefined, source: MdastNode, kind: Parameters<CompileContext['ids']['request']>[1]): T => {
  if (rawId !== undefined) node.id = explicitIdOf(rawId, context.file, positionOf(source));
  else context.ids.request(node, kind);
  return located(context, node, source);
};

/** 一个文件最外层的内容：按标题建节（# 是章），标题之间的块放进最近的节 */
export function sectionsOf(context: CompileContext, root: MdastNode, fileNumbering: Section['numbering']): AnyBlock[] {
  const top: AnyBlock[] = [];
  const open: { depth: number; section: Section }[] = [];
  for (const node of root.children as MdastNode[]) {
    if (node.type === 'yaml') continue;
    if (node.type === 'heading') {
      while (open.length && open.at(-1)!.depth >= node.depth) open.pop();
      const parent = open.at(-1);
      const parentDepth = parent?.depth ?? 0;
      if (node.depth !== parentDepth + 1) failAt(context, node, parentDepth === 0 ? `这里是文件里最外层的标题，要写成一级标题 #，写成了 ${node.depth} 级` : `标题跳级：上一级是 ${parentDepth} 级，这里写了 ${node.depth} 级`);
      const numbering: Section['numbering'] = !parent ? fileNumbering : parent.section.numbering === 'none' ? 'none' : 'decimal';
      const section = sectionOf(context, node, numbering);
      (parent?.section.children ?? top).push(section);
      open.push({ depth: node.depth, section });
      continue;
    }
    const container = open.at(-1)?.section.children ?? top;
    container.push(...(blocksOf(context, [node], 'top') as never[]));
  }
  return top;
}

function sectionOf(context: CompileContext, heading: MdastNode, numbering: Section['numbering']): Section {
  if ((heading.children as MdastNode[]).some((child) => child.type !== 'text')) failAt(context, heading, '标题里只能写文字（不能有公式、加粗、链接、组件）');
  const raw = (heading.children as MdastNode[]).map((child) => child.value as string).join('');
  const anchor = /\s*\[#([^\]]*)\]\s*$/.exec(raw);
  const title = (anchor ? raw.slice(0, anchor.index) : raw).trim();
  if (!title) failAt(context, heading, '标题不能空');
  const section: Section = { type: 'section', id: '', title, numbering, children: [] };
  if (anchor) {
    section.id = explicitIdOf(anchor[1]!, context.file, positionOf(heading));
    return located(context, section, heading);
  }
  context.ids.request(section, 'sec', title);
  return located(context, section, heading);
}

/** 一串块级 MDX → docreport 块；放在不允许的位置的块报错 */
export function blocksOf(context: CompileContext, nodes: MdastNode[], place: BlockPlace): AnyBlock[] {
  const blocks: AnyBlock[] = [];
  for (const node of nodes) {
    for (const block of blockOf(context, node, place)) {
      if (!ALLOWED_BLOCKS[place].has(block.type)) failAt(context, node, `${PLACE_NAMES[place]}里不能放${BLOCK_NAMES[block.type] ?? block.type}`);
      blocks.push(block);
    }
  }
  return blocks;
}

const isWhitespaceText = (node: MdastNode) => node.type === 'text' && !String(node.value).trim();

function blockOf(context: CompileContext, node: MdastNode, place: BlockPlace): AnyBlock[] {
  switch (node.type) {
    case 'paragraph': {
      const meaningful = (node.children as MdastNode[]).filter((child) => !isCommentOnlyExpression(child) && !isWhitespaceText(child));
      if (meaningful.length === 0) return [];
      const only = meaningful.length === 1 ? meaningful[0]! : undefined;
      if (only?.type === 'mdxJsxTextElement' && BLOCK_COMPONENTS.has(only.name)) return [componentOf(context, only, place)];
      return [paragraphOf(context, node.children, node)];
    }
    case 'list': return [listOf(context, node)];
    case 'code': return [codeOf(context, node)];
    case 'math':
      if (node.meta) failAt(context, node, '$$ 公式不编号、不写 id；要编号或被引用就写成 ```math <id> 代码块');
      return [located(context, context.ids.request<Equation>({ type: 'equation', id: '', latex: node.value, numbered: false }, 'eq'), node)];
    case 'table': return [tableFromGfm(context, node, false, undefined, undefined)];
    case 'mdxJsxFlowElement': return [componentOf(context, node, place)];
    case 'mdxFlowExpression':
      if (!isCommentOnlyExpression(node)) failAt(context, node, '正文里不能写 {…} 表达式；注释写成 {/* … */}');
      return [];
    case 'footnoteDefinition': {
      const id = explicitIdOf(node.label ?? node.identifier, context.file, positionOf(node));
      context.notes.push(located(context, { id, blocks: blocksOf(context, node.children, 'note') as never[] }, node));
      return [];
    }
    case 'heading': return failAt(context, node, '标题只能写在文件的最外层，不能写进列表、组件或脚注');
    case 'mdxjsEsm': return failAt(context, node, '报告里不写 import / export：组件都是内置的');
    case 'blockquote': return failAt(context, node, '不支持引用块 >');
    case 'thematicBreak': return failAt(context, node, '不支持分隔线');
    case 'html': return failAt(context, node, '不支持原始 HTML');
    case 'definition': return failAt(context, node, '不支持链接定义 [名字]: 地址');
    case 'yaml': return failAt(context, node, '文件头只能写在文件开头');
    default: return failAt(context, node, `这里不能写 ${node.type}`);
  }
}

function paragraphOf(context: CompileContext, children: MdastNode[], source: MdastNode): Paragraph {
  return located(context, context.ids.request<Paragraph>({ type: 'paragraph', id: '', content: inlinesOf(context, children) }, 'p'), source);
}

function listOf(context: CompileContext, node: MdastNode): ReportList {
  const ordered = Boolean(node.ordered);
  const list: ReportList = { type: 'list', id: '', ordered, items: [] };
  if (ordered && typeof node.start === 'number' && node.start !== 1) list.start = node.start;
  for (const item of node.children as MdastNode[]) {
    if (item.checked !== null && item.checked !== undefined) failAt(context, item, '不支持任务列表 [ ] / [x]');
    list.items.push(located(context, context.ids.request({ id: '', blocks: blocksOf(context, item.children, 'listItem') as ReportList['items'][number]['blocks'] }, 'li'), item));
  }
  return located(context, context.ids.request(list, 'list'), node);
}

function codeOf(context: CompileContext, node: MdastNode): AnyBlock {
  if (node.lang === 'math') {
    const meta = (node.meta ?? '').trim();
    if (/\s/.test(meta)) failAt(context, node, '```math 后面只能写一个 id');
    return explicitOrRequested<Equation>(context, { type: 'equation', id: '', latex: node.value, numbered: true }, meta || undefined, node, 'eq');
  }
  if (node.meta) failAt(context, node, `代码块的语言名 ${node.lang} 后面不能再写别的`);
  return located(context, context.ids.request({ type: 'code' as const, id: '', language: node.lang ?? 'text', text: node.value }, 'code'), node);
}

function componentOf(context: CompileContext, element: MdastNode, place: BlockPlace): AnyBlock {
  switch (element.name) {
    case 'WordFigure': return figureOf(context, element);
    case 'WordFigures': return multiFigureOf(context, element);
    case 'WordTable': return numberedTableOf(context, element);
    case 'WordAbstract': return abstractOf(context, element, place);
    case 'WordBibliography':
      attributesOf(context, element, {});
      if ((element.children as MdastNode[]).some((child) => !isCommentOnlyExpression(child))) failAt(context, element, '<WordBibliography /> 不收子内容');
      return located(context, context.ids.request({ type: 'bibliography' as const, id: '' }, 'bib'), element);
    case 'WordReference': return failAt(context, element, '<WordReference> 只能写在报告目录的 references.mdx 里');
    case 'WordCaption': return failAt(context, element, '<WordCaption> 只能写在 <WordTable> 或 <WordFigures> 里');
    case 'WordPanel': return failAt(context, element, '<WordPanel> 只能写在 <WordFigures> 里');
    case 'table':
    case 'tr':
    case 'th':
    case 'td': return failAt(context, element, `<${element.name}> 只能写在 <WordTable> 里：不编号的简单表格直接写 GFM 表格`);
    default: return failAt(context, element, unknownComponentMessage(element.name ?? '', '块级只能用 WordFigure、WordFigures、WordTable、WordAbstract、WordBibliography'));
  }
}

function captionOf(context: CompileContext, element: MdastNode, what: string): ReportInline[] {
  const caption = inlinesOf(context, phrasingChildrenOf(context, element));
  if (!caption.length) failAt(context, element, `${what}不能空`);
  return caption;
}

function figureOf(context: CompileContext, element: MdastNode): Figure {
  const attributes = attributesOf(context, element, { id: 'optional', src: 'required', alt: 'optional' });
  const caption = captionOf(context, element, '<WordFigure> 的图题');
  return explicitOrRequested<Figure>(context, { type: 'figure', id: '', src: attributes['src']!, caption, alt: attributes['alt'] ?? plainTextOf(caption) }, attributes['id'], element, 'fig');
}

function multiFigureOf(context: CompileContext, element: MdastNode): Figure {
  const attributes = attributesOf(context, element, { id: 'optional', rows: 'required', columns: 'required' });
  const children = elementChildrenOf(context, element);
  const captions = children.filter((child) => child.name === 'WordCaption');
  if (captions.length !== 1) failAt(context, element, '<WordFigures> 里要有且只有一个 <WordCaption> 写整个图的图题');
  for (const child of children) if (child.name !== 'WordCaption' && child.name !== 'WordPanel') failAt(context, child, `<WordFigures> 里只能放 <WordCaption> 与 <WordPanel>，不能放 <${child.name}>`);
  attributesOf(context, captions[0]!, {});
  const caption = captionOf(context, captions[0]!, '<WordFigures> 的图题');
  const panels = children.filter((child) => child.name === 'WordPanel').map((panel) => panelOf(context, panel));
  const figure = { type: 'figure', id: '', caption, rows: positiveIntegerOf(context, element, 'rows', attributes['rows']!), columns: positiveIntegerOf(context, element, 'columns', attributes['columns']!), panels } as Figure;
  return explicitOrRequested(context, figure, attributes['id'], element, 'fig');
}

function panelOf(context: CompileContext, element: MdastNode): FigurePanel {
  const attributes = attributesOf(context, element, { id: 'optional', row: 'required', column: 'required', label: 'required', src: 'required', alt: 'optional' });
  const caption = inlinesOf(context, phrasingChildrenOf(context, element));
  const alt = attributes['alt'] ?? plainTextOf(caption);
  if (!alt) failAt(context, element, '<WordPanel> 没有小标题时要写 alt');
  const panel: FigurePanel = {
    id: '', row: positiveIntegerOf(context, element, 'row', attributes['row']!), column: positiveIntegerOf(context, element, 'column', attributes['column']!),
    label: attributes['label']!, src: attributes['src']!, alt,
  };
  if (caption.length) panel.caption = caption;
  return explicitOrRequested(context, panel, attributes['id'], element, 'panel');
}

function numberedTableOf(context: CompileContext, element: MdastNode): Table {
  const attributes = attributesOf(context, element, { id: 'optional' });
  const parts = (element.children as MdastNode[]).filter((child) => !isCommentOnlyExpression(child) && !isWhitespaceText(child))
    .flatMap((child) => (child.type === 'paragraph' ? (child.children as MdastNode[]).filter((inner) => !isWhitespaceText(inner)) : [child]));
  let caption: ReportInline[] | undefined;
  if (parts[0]?.name === 'WordCaption') {
    attributesOf(context, parts[0], {});
    caption = captionOf(context, parts.shift()!, '<WordCaption> 的表题');
  }
  const body = parts[0];
  if (parts.length !== 1 || !body || !(body.type === 'table' || body.name === 'table')) failAt(context, element, '<WordTable> 里先写可省的 <WordCaption>，再写一张表（GFM 表格或 <table>），别的不放');
  return body.type === 'table' ? tableFromGfm(context, body, true, caption, attributes['id'] ?? null, element) : tableFromJsx(context, body, caption, attributes['id'] ?? null, element);
}

function finishedTable(context: CompileContext, table: Table, caption: ReportInline[] | undefined, rawId: string | null | undefined, source: MdastNode): Table {
  if (caption) table.caption = caption;
  return explicitOrRequested(context, table, rawId ?? undefined, source, 'tbl');
}

function cellOf(context: CompileContext, blocks: CellBlock[], source: MdastNode, spans: { rowSpan?: number; colSpan?: number } = {}): TableCell {
  return located(context, context.ids.request<TableCell>({ id: '', ...spans, blocks }, 'cell'), source);
}

const columnsOf = (context: CompileContext, count: number) => Array.from({ length: count }, () => context.ids.request({ id: '' }, 'col'));

function tableFromGfm(context: CompileContext, node: MdastNode, numbered: boolean, caption: ReportInline[] | undefined, rawId: string | null | undefined, source: MdastNode = node): Table {
  const rows = node.children as MdastNode[];
  const width = rows[0]!.children.length;
  const table: Table = {
    type: 'table', id: '', numbered, headerRows: 1, columns: columnsOf(context, width),
    rows: rows.map((row) => {
      if (row.children.length !== width) failAt(context, row, `这一行有 ${row.children.length} 格，表头有 ${width} 格：每行格数要和表头一样`);
      return located(context, context.ids.request({ id: '', cells: (row.children as MdastNode[]).map((cell) => cellOf(context, [paragraphOf(context, cell.children, cell)], cell)) }, 'row'), row);
    }),
  };
  return finishedTable(context, table, caption, rawId, source);
}

function spanOf(context: CompileContext, cell: MdastNode, attributes: Record<string, string>, name: 'rowSpan' | 'colSpan'): number | undefined {
  return attributes[name] === undefined ? undefined : positiveIntegerOf(context, cell, name, attributes[name]!);
}

function jsxCellOf(context: CompileContext, cell: MdastNode): TableCell {
  const attributes = attributesOf(context, cell, { rowSpan: 'optional', colSpan: 'optional' });
  const spans: { rowSpan?: number; colSpan?: number } = {};
  const rowSpan = spanOf(context, cell, attributes, 'rowSpan'), colSpan = spanOf(context, cell, attributes, 'colSpan');
  if (rowSpan !== undefined) spans.rowSpan = rowSpan;
  if (colSpan !== undefined) spans.colSpan = colSpan;
  const children = (cell.children as MdastNode[]).filter((child) => !isCommentOnlyExpression(child) && !isWhitespaceText(child));
  const blocks = children.length === 0 || cell.type === 'mdxJsxTextElement' ? [paragraphOf(context, children, cell)] : blocksOf(context, children, 'cell') as CellBlock[];
  return cellOf(context, blocks, cell, spans);
}

function tableFromJsx(context: CompileContext, element: MdastNode, caption: ReportInline[] | undefined, rawId: string | null | undefined, source: MdastNode): Table {
  attributesOf(context, element, {});
  const rowElements = elementChildrenOf(context, element);
  if (!rowElements.length) failAt(context, element, '<table> 里至少要有一行 <tr>');
  let headerRows = 0, headerEnded = false;
  const rows = rowElements.map((row) => {
    if (row.name !== 'tr') failAt(context, row, `<table> 里只能放 <tr>，不能放 <${row.name}>`);
    attributesOf(context, row, {});
    const cellElements = elementChildrenOf(context, row);
    if (!cellElements.length) failAt(context, row, '<tr> 里至少要有一格');
    for (const cell of cellElements) if (cell.name !== 'th' && cell.name !== 'td') failAt(context, cell, `<tr> 里只能放 <th> 与 <td>，不能放 <${cell.name}>`);
    const allHeader = cellElements.every((cell) => cell.name === 'th');
    if (allHeader && !headerEnded) headerRows++;
    else {
      headerEnded = true;
      const header = cellElements.find((cell) => cell.name === 'th');
      if (header) failAt(context, header, '<th> 只能用在表格开头连续的表头行里');
    }
    return located(context, context.ids.request({ id: '', cells: cellElements.map((cell) => jsxCellOf(context, cell)) }, 'row'), row);
  });
  const width = rows[0]!.cells.reduce((sum, cell) => sum + (cell.colSpan ?? 1), 0);
  return finishedTable(context, { type: 'table', id: '', numbered: true, headerRows, columns: columnsOf(context, width), rows }, caption, rawId, source);
}

function abstractOf(context: CompileContext, element: MdastNode, place: BlockPlace): AnyBlock {
  if (context.role !== 'index' || place !== 'top') failAt(context, element, '<WordAbstract> 只能写在 index.mdx 的正文最前面');
  const attributes = attributesOf(context, element, { keywords: 'required', title: 'optional' });
  const keywords = attributes['keywords']!.split('；').map((keyword) => keyword.trim());
  if (keywords.some((keyword) => !keyword)) failAt(context, element, '<WordAbstract> 的 keywords 用全角分号「；」隔开，每个关键词都不能空');
  const paragraphs = blocksOf(context, (element.children as MdastNode[]).filter((child) => !isWhitespaceText(child)), 'abstract');
  const abstract: Record<string, unknown> & { type: 'abstract'; id: string } = { type: 'abstract', id: '', paragraphs, keywords };
  if (attributes['title'] !== undefined) abstract['title'] = attributes['title'];
  return located(context, context.ids.request(abstract, 'abs'), element);
}
