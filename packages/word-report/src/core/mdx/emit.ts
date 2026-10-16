import { stringify } from 'yaml';
import type { ReportBlock, ReportDocument, ReportInline, Section, Table } from '../types.ts';
import { walk } from '../validate.ts';
import { MDX_ENTRY_NAME, MDX_REFERENCES_NAME } from './compile.ts';
import { plainTextOf } from './inline.ts';

/**
 * 组装好的 docreport 文档 → 一份 MDX 报告的各个文件：convert 命令用它迁移 JSON 报告。
 * 只有被引用的、layout.json 里出现的、文献与脚注的 id 写出来，其余交给编译器重新生成；
 * MDX 写不出的内容记进 problems（带 JSON 指针），有一条就不该写文件
 */
export interface MdxReportPlan {
  /** 文件名（相对新报告目录）→ MDX 原文 */
  files: Record<string, string>;
  /** 新报告里的图片文件名（assets/ 下）→ 原图在组装结果里的路径（AssemblyResult.assets 的键） */
  images: Record<string, string>;
  /** 写出来的手写 id：比对时只有它们要求两边一样 */
  keptIds: Set<string>;
  problems: string[];
}

type AnyBlock = ReportBlock | Extract<ReportDocument['blocks'][number], { type: 'abstract' }>;

const UNICODE_PUNCTUATION = /[\p{P}\p{S}]/u;
const MARK_WRAP_ORDER = ['code', 'sub', 'sup', 'em', 'strong'] as const;

/** Markdown 与 MDX 的特殊字符一律加反斜杠；GFM 会把网址与邮箱自动变成链接，冒号、点与 @ 也拆开 */
function escapedText(text: string): string {
  return text
    .replace(/[\\`*_{}[\]<>$|~&#@]/g, (character) => `\\${character}`)
    .replace(/:\/\//g, '\\://')
    .replace(/www\./gi, (match) => `${match.slice(0, 3)}\\.`);
}

/** 一段的开头像列表、标题、引用的，再加一层转义 */
function escapedLineStart(line: string): string {
  return line.replace(/^(\d+)([.)])/, '$1\\$2').replace(/^([-+])(\s|$)/, '\\$1$2');
}

function codeSpan(text: string): string {
  const longest = Math.max(0, ...(text.match(/`+/g) ?? []).map((run) => run.length));
  const fence = '`'.repeat(longest + 1);
  const padding = text.startsWith('`') || text.endsWith('`') ? ' ' : '';
  return `${fence}${padding}${text}${padding}${fence}`;
}

/** 加粗、斜体在内容首尾不是空白与标点时用 ** 与 *（中文旁边才认得出），否则用 <strong> 与 <em> */
function wrappedWithMark(inner: string, plain: string, mark: (typeof MARK_WRAP_ORDER)[number]): string {
  if (mark === 'sub' || mark === 'sup') return `<${mark}>${inner}</${mark}>`;
  const first = plain[0], last = plain.at(-1);
  const delimiterSafe = first !== undefined && last !== undefined && !/\s/.test(first) && !/\s/.test(last) && !UNICODE_PUNCTUATION.test(first) && !UNICODE_PUNCTUATION.test(last);
  if (delimiterSafe) return mark === 'strong' ? `**${inner}**` : `*${inner}*`;
  return `<${mark}>${inner}</${mark}>`;
}

function attributeOf(name: string, value: string, problems: string[], at: string): string {
  if (!value.includes('"')) return ` ${name}="${value}"`;
  if (!value.includes("'")) return ` ${name}='${value}'`;
  problems.push(`${at}：${name} 里同时有单引号和双引号，写不成组件属性`);
  return '';
}

class MdxWriter {
  readonly problems: string[] = [];
  readonly images: Record<string, string> = Object.create(null);
  private readonly keptIds: Set<string>;
  private readonly assets: Record<string, string>;

  constructor(keptIds: Set<string>, assets: Record<string, string>) {
    this.keptIds = keptIds;
    this.assets = assets;
  }

  idAttribute(id: string | undefined, at: string): string {
    return id !== undefined && this.keptIds.has(id) ? attributeOf('id', id, this.problems, at) : '';
  }

  /** 图片按文件名放进新报告的 assets/：同名不同图报错 */
  imagePath(src: string, at: string): string {
    const original = this.assets[src] ?? src;
    const name = original.slice(original.lastIndexOf('/') + 1);
    const previous = this.images[name];
    if (previous !== undefined && previous !== src) this.problems.push(`${at}：图片 ${name} 和 ${previous} 同名，放进同一个 assets/ 会互相覆盖`);
    this.images[name] = src;
    return `assets/${name}`;
  }

  inlines(inlines: ReportInline[], at: string): string {
    let previousWasMath = false;
    return inlines.map((inline, index) => {
      const here = `${at}/${index}`;
      if (inline.type === 'math' && previousWasMath) this.problems.push(`${here}：两个行内公式紧挨着，写成 $…$$…$ 会被读成一个`);
      previousWasMath = inline.type === 'math';
      switch (inline.type) {
        case 'text': {
          let written = (inline.marks ?? []).includes('code') ? codeSpan(inline.text) : escapedText(inline.text);
          for (const mark of MARK_WRAP_ORDER) if (mark !== 'code' && inline.marks?.includes(mark)) written = wrappedWithMark(written, inline.text, mark);
          return written;
        }
        case 'math':
          if (inline.latex.includes('$') || /[\r\n]/.test(inline.latex)) this.problems.push(`${here}：行内公式里有 $ 或换行，写不成 $…$`);
          return `$${inline.latex}$`;
        case 'ref': return `<Ref to="${inline.target}"${inline.display === 'label' ? '' : ` show="${inline.display}"`} />`;
        case 'cite': return `<Cite to="${inline.targets.join(' ')}" />`;
        case 'link': return `[${escapedText(inline.text)}](${/[\s()<>]/.test(inline.href) ? `<${inline.href}>` : inline.href})`;
        case 'note_ref': return `[^${inline.target}]`;
        case 'break': return '<br />';
      }
    }).join('');
  }

  /** 段落各占一行写出；表格单元格里的段落不在行首，不用防它被读成列表，空段落就是空格子 */
  paragraph(content: ReportInline[], at: string, insideCell = false): string {
    if (!content.length && !insideCell) this.problems.push(`${at}：没有内容的段落在 MDX 里写不出来`);
    const written = this.inlines(content, `${at}/content`);
    return insideCell ? written : escapedLineStart(written);
  }

  /** 一个单元格：只有一段（含空段，即空格子）写成行内内容，否则 null（要写成块）；没有块的格子编译回来是一个空段 */
  cellInline(blocks: Table['rows'][number]['cells'][number]['blocks'], at: string): string | null {
    if (blocks.length === 0) return '';
    const only = blocks.length === 1 ? blocks[0] : undefined;
    return only?.type === 'paragraph' ? this.paragraph(only.content, `${at}/blocks/0`, true) : null;
  }

  /** 块之间空一行；相邻两个同类列表中间放一个注释，否则会并成一个列表 */
  blocks(blocks: AnyBlock[], at: string, depth: number, parentNumbering: Section['numbering']): string[] {
    const lines: string[] = [];
    blocks.forEach((block, index) => {
      const previous = blocks[index - 1];
      if (block.type === 'list' && previous?.type === 'list' && previous.ordered === block.ordered) lines.push('{/* 两个列表的分界 */}');
      lines.push(this.block(block, `${at}/${index}`, depth, parentNumbering));
    });
    return lines;
  }

  block(block: AnyBlock, at: string, depth: number, parentNumbering: Section['numbering']): string {
    switch (block.type) {
      case 'section': return this.section(block, at, depth, parentNumbering);
      case 'paragraph': return this.paragraph(block.content, at);
      case 'list': return this.list(block, at, '');
      case 'figure': return this.figure(block, at);
      case 'table': return this.table(block, at);
      case 'equation': {
        if (!block.numbered) {
          if (block.latex.includes('$$')) this.problems.push(`${at}：公式里有 $$，写不成 $$ 块`);
          if (this.keptIds.has(block.id)) this.problems.push(`${at}：不编号的公式被引用或写在 layout.json 里，MDX 里不编号的公式没有 id`);
          return `$$\n${block.latex}\n$$`;
        }
        const fence = '`'.repeat(Math.max(3, ...(block.latex.match(/`{3,}/g) ?? []).map((run) => run.length + 1)));
        return `${fence}math${this.keptIds.has(block.id) ? ` ${block.id}` : ''}\n${block.latex}\n${fence}`;
      }
      case 'code': {
        if (block.language === 'math') this.problems.push(`${at}：语言是 math 的代码块在 MDX 里会被当成编号公式`);
        const fence = '`'.repeat(Math.max(3, ...(block.text.match(/`{3,}/g) ?? []).map((run) => run.length + 1)));
        return `${fence}${block.language}\n${block.text}\n${fence}`;
      }
      case 'bibliography':
        this.problems.push(`${at}：<Bibliography /> 只能放在文末（不写时组装会补上）`);
        return '';
      case 'abstract': return this.abstract(block, at);
    }
  }

  abstract(block: Extract<AnyBlock, { type: 'abstract' }>, at: string): string {
    if (block.keywords.some((keyword) => keyword.includes('；'))) this.problems.push(`${at}：关键词里有全角分号，<Abstract keywords> 用它分隔`);
    const title = block.title !== undefined ? attributeOf('title', block.title, this.problems, at) : '';
    const paragraphs = block.paragraphs.map((paragraph, index) => this.paragraph(paragraph.content, `${at}/paragraphs/${index}`));
    return `<Abstract keywords="${block.keywords.join('；')}"${title}>\n\n${paragraphs.join('\n\n')}\n\n</Abstract>`;
  }

  section(section: Section, at: string, depth: number, parentNumbering: Section['numbering']): string {
    if (depth > 6) this.problems.push(`${at}：标题超过六级`);
    const expected: Section['numbering'] = parentNumbering === 'none' ? 'none' : 'decimal';
    if (depth > 1 && section.numbering !== expected) this.problems.push(`${at}：${parentNumbering} 节下面的 ${section.numbering} 子节在 MDX 里写不出来（子节跟着上级编号）`);
    if (/\[#[^\]]*\]\s*$/.test(section.title)) this.problems.push(`${at}：标题末尾的 [#…] 会被当成节的 id`);
    const heading = `${'#'.repeat(depth)} ${escapedText(section.title)}${this.keptIds.has(section.id) ? ` [#${section.id}]` : ''}`;
    return [heading, ...this.blocks(section.children, `${at}/children`, depth + 1, section.numbering)].join('\n\n');
  }

  list(list: Extract<AnyBlock, { type: 'list' }>, at: string, indent: string): string {
    return list.items.map((item, index) => {
      const marker = list.ordered ? `${(list.start ?? 1) + index}. ` : '- ';
      const continuation = indent + ' '.repeat(marker.length);
      const parts = item.blocks.map((block, blockIndex) => {
        const here = `${at}/items/${index}/blocks/${blockIndex}`;
        return block.type === 'list' ? this.list(block, here, continuation) : this.paragraph(block.content, here);
      });
      return parts.map((part, partIndex) => (partIndex === 0 ? `${indent}${marker}${part.trimStart()}` : part.startsWith(continuation) ? part : `${continuation}${part}`)).join('\n\n');
    }).join('\n');
  }

  figure(figure: Extract<AnyBlock, { type: 'figure' }>, at: string): string {
    const caption = this.inlines(figure.caption, `${at}/caption`);
    if (!figure.panels) {
      const alt = figure.alt === plainTextOf(figure.caption) ? '' : attributeOf('alt', figure.alt, this.problems, at);
      return `<Figure${this.idAttribute(figure.id, at)} src="${this.imagePath(figure.src, at)}"${alt}>${caption}</Figure>`;
    }
    const panels = figure.panels.map((panel, index) => {
      const here = `${at}/panels/${index}`;
      const panelCaption = panel.caption ? this.inlines(panel.caption, `${here}/caption`) : '';
      const alt = panel.caption && panel.alt === plainTextOf(panel.caption) ? '' : attributeOf('alt', panel.alt, this.problems, here);
      const open = `  <Panel${this.idAttribute(panel.id, here)} row="${panel.row}" column="${panel.column}"${attributeOf('label', panel.label, this.problems, here)} src="${this.imagePath(panel.src, here)}"${alt}`;
      return panelCaption ? `${open}>${panelCaption}</Panel>` : `${open} />`;
    });
    return [`<Figures${this.idAttribute(figure.id, at)} rows="${figure.rows}" columns="${figure.columns}">`, `  <Caption>${caption}</Caption>`, ...panels, '</Figures>'].join('\n');
  }

  table(table: Table, at: string): string {
    const caption = table.caption ? this.inlines(table.caption, `${at}/caption`) : undefined;
    if (!table.numbered) {
      if (caption !== undefined) this.problems.push(`${at}：带表题的不编号表格在 MDX 里写不出来`);
      if (!this.fitsGfm(table)) this.problems.push(`${at}：不编号的表格只能写成 GFM 表格，这张有合并单元格、多行表头或多段内容`);
      return this.gfmTable(table, at);
    }
    const body = this.fitsGfm(table) ? this.gfmTable(table, at) : this.jsxTable(table, at);
    return [`<Table${this.idAttribute(table.id, at)}>`, ...(caption !== undefined ? [`  <Caption>${caption}</Caption>`] : []), '', body, '', '</Table>'].join('\n');
  }

  fitsGfm(table: Table): boolean {
    const fitsOneGfmCell = (blocks: Table['rows'][number]['cells'][number]['blocks']) => blocks.length === 0
      || (blocks.length === 1 && blocks[0]!.type === 'paragraph'
        && blocks[0]!.content.every((inline) => inline.type !== 'break' && (inline.type !== 'math' || !inline.latex.includes('|'))));
    return table.headerRows === 1 && table.rows.every((row) => row.cells.length === table.columns.length && row.cells.every((cell) => !cell.rowSpan && !cell.colSpan && fitsOneGfmCell(cell.blocks)));
  }

  gfmTable(table: Table, at: string): string {
    const lines = table.rows.map((row, rowIndex) => `| ${row.cells.map((cell, cellIndex) => this.cellInline(cell.blocks, `${at}/rows/${rowIndex}/cells/${cellIndex}`) ?? '').join(' | ')} |`);
    lines.splice(1, 0, `| ${table.columns.map(() => '---').join(' | ')} |`);
    return lines.join('\n');
  }

  jsxTable(table: Table, at: string): string {
    const rows = table.rows.map((row, rowIndex) => {
      const tag = rowIndex < table.headerRows ? 'th' : 'td';
      const cells = row.cells.map((cell, cellIndex) => {
        const here = `${at}/rows/${rowIndex}/cells/${cellIndex}`;
        const spans = `${cell.rowSpan ? ` rowSpan="${cell.rowSpan}"` : ''}${cell.colSpan ? ` colSpan="${cell.colSpan}"` : ''}`;
        const inline = this.cellInline(cell.blocks, here);
        if (inline !== null) return `<${tag}${spans}>${inline}</${tag}>`;
        return `<${tag}${spans}>\n\n${this.blocks(cell.blocks, `${here}/blocks`, 7, 'decimal').join('\n\n')}\n\n</${tag}>`;
      });
      return `  <tr>${cells.join('')}</tr>`;
    });
    return ['<table>', ...rows, '</table>'].join('\n');
  }
}

const isGeneratedBibliography = (block: ReportDocument['blocks'][number], document: ReportDocument) => block.type === 'bibliography' && block.id === `${document.id.slice(0, 48)}_bibliography`;

/** 哪些 id 要写出来：被 ref 指到的、layout.json 的键、文献与脚注（它们本来就靠 id 对应） */
export function keptIdsOf(document: ReportDocument, layoutKeys: string[]): Set<string> {
  const kept = new Set<string>(layoutKeys);
  for (const { node } of walk(document)) if (node.type === 'ref') kept.add(node.target);
  for (const reference of document.references ?? []) kept.add(reference.id);
  for (const note of document.notes ?? []) kept.add(note.id);
  return kept;
}

function chapterFileNames(sections: Section[]): string[] {
  const taken = new Set([MDX_ENTRY_NAME, MDX_REFERENCES_NAME]);
  return sections.map((section, index) => {
    const preferred = /^[a-z0-9][a-z0-9-]{0,40}$/.test(section.id) ? `${section.id}.mdx` : `chapter-${index + 1}.mdx`;
    const name = taken.has(preferred) ? `chapter-${index + 1}.mdx` : preferred;
    taken.add(name);
    return name;
  });
}

/** GFM 只认同一个文件里的脚注定义：每条脚注的定义写进引用它的那个文件（入口正文或某一章）的末尾 */
function notesByFile(document: ReportDocument, frontBlocks: AnyBlock[], sections: Section[], names: string[], writer: MdxWriter): Map<string, string[]> {
  const fileOfNote = new Map<string, string>();
  const collect = (value: unknown, file: string) => { for (const { node } of walk(value)) if (node.type === 'note_ref') fileOfNote.set(node.target, file); };
  collect(frontBlocks, MDX_ENTRY_NAME);
  sections.forEach((section, index) => collect(section, names[index]!));
  const byFile = new Map<string, string[]>();
  (document.notes ?? []).forEach((note, index) => {
    const at = `/notes/${index}`;
    const [first, ...rest] = note.blocks;
    if (first?.type !== 'paragraph' || rest.length) writer.problems.push(`${at}：脚注只转一段文字的，这条有 ${note.blocks.length} 块`);
    const file = fileOfNote.get(note.id) ?? MDX_ENTRY_NAME;
    byFile.set(file, [...(byFile.get(file) ?? []), `[^${note.id}]: ${first?.type === 'paragraph' ? writer.paragraph(first.content, `${at}/blocks/0`) : ''}`]);
  });
  return byFile;
}

/** 组装好的文档 → MDX 报告。assets 是组装结果的 assets（图在组装结果里的路径 → 原图路径） */
export function mdxReportPlanOf(document: ReportDocument, assets: Record<string, string>, layoutKeys: string[]): MdxReportPlan {
  const keptIds = keptIdsOf(document, layoutKeys);
  const writer = new MdxWriter(keptIds, assets);
  const firstSection = document.blocks.findIndex((block) => block.type === 'section');
  const frontBlocks = (firstSection < 0 ? document.blocks : document.blocks.slice(0, firstSection))
    .filter((block, index, all) => !(firstSection < 0 && index === all.length - 1 && isGeneratedBibliography(block, document))) as AnyBlock[];
  const sections: Section[] = [];
  document.blocks.forEach((block, index) => {
    if (index < firstSection || firstSection < 0) return;
    if (block.type === 'section') sections.push(block);
    else if (!(index === document.blocks.length - 1 && isGeneratedBibliography(block, document))) writer.problems.push(`/blocks/${index}：第一章之后的顶层 ${block.type} 在 MDX 里写不出来（顶层内容只能写在 index.mdx 的正文、第一章之前）`);
  });
  const names = chapterFileNames(sections);
  const notesOf = notesByFile(document, frontBlocks, sections, names, writer);
  const files: Record<string, string> = Object.create(null);
  for (const [index, section] of sections.entries()) {
    const at = `/blocks/${firstSection + index}`;
    const frontmatter = section.numbering === 'decimal' ? '' : `---\nnumbering: ${section.numbering}\n---\n\n`;
    files[names[index]!] = `${frontmatter}${[writer.section(section, at, 1, 'decimal'), ...(notesOf.get(names[index]!) ?? [])].join('\n\n')}\n`;
  }
  const { metadata } = document;
  const header: Record<string, unknown> = { title: metadata.title };
  if (metadata.shortTitle !== undefined) header['shortTitle'] = metadata.shortTitle;
  header['language'] = metadata.language;
  if (metadata.authors !== undefined) header['authors'] = metadata.authors;
  if (metadata.date !== undefined) header['date'] = metadata.date;
  if (metadata.revision !== undefined) header['revision'] = metadata.revision;
  if (metadata.fields !== undefined) header['fields'] = metadata.fields;
  if (names.length) header['chapters'] = names;
  const body = [...writer.blocks(frontBlocks, '/blocks', 1, 'decimal'), ...(notesOf.get(MDX_ENTRY_NAME) ?? [])].join('\n\n');
  files[MDX_ENTRY_NAME] = `---\n${stringify(header, { lineWidth: 0 })}---\n${body ? `\n${body}\n` : ''}`;
  if (document.references?.length) {
    files[MDX_REFERENCES_NAME] = `${document.references.map((reference, index) => `<Reference${attributeOf('id', reference.id, writer.problems, `/references/${index}`)}${reference.url !== undefined ? attributeOf('url', reference.url, writer.problems, `/references/${index}`) : ''}>${escapedText(reference.text)}</Reference>`).join('\n\n')}\n`;
  }
  return { files, images: writer.images, keptIds, problems: writer.problems };
}
