import { assembleDocument } from '../assemble.ts';
import { walk } from '../validate.ts';
import { ReportContentError, type AssemblyOptions, type AssemblyResult, type ReportDocument, type SourceLocation } from '../types.ts';
import { sectionsOf } from './blocks.ts';
import { failAt, isCommentOnlyExpression, located, type CompileContext, type MdastNode, type MdxFileRole } from './context.ts';
import { chapterNumberingOf, indexFrontmatterOf, rejectFrontmatter } from './frontmatter.ts';
import { explicitIdOf, GeneratedIds } from './ids.ts';
import { inlinesOf } from './inline.ts';
import { attributesOf, phrasingChildrenOf } from './jsx.ts';
import { parseMdx, positionOf } from './parse.ts';

/** 报告目录里固定名字的两个文件 */
export const MDX_ENTRY_NAME = 'index.mdx';
export const MDX_REFERENCES_NAME = 'references.mdx';

export interface MdxReportInput {
  /** 报告目录名，用作文档 id */
  reportId: string;
  /** 入口 index.mdx 在 files 里的键；章与文献列表的路径相对它所在的目录 */
  entry: string;
  /** 路径 → MDX 原文：入口、chapters 列的各章，以及存在时的 references.mdx */
  files: Record<string, string>;
}

export interface CompiledMdxReport {
  document: ReportDocument;
  /** 节点 id → MDX 文件与「行:列」 */
  sources: Record<string, SourceLocation>;
  /** 编译结果里的 JSON 指针 → 最近的有记录的上级节点的 MDX 位置 */
  locate(pointer: string): SourceLocation | undefined;
  /** 编进来的 MDX 文件，按入口、各章、文献列表的顺序 */
  files: string[];
}

const directoryOf = (file: string) => (file.includes('/') ? file.slice(0, file.lastIndexOf('/')) : '');
const inDirectory = (directory: string, name: string) => (directory ? `${directory}/${name}` : name);

/** 读入口原文就知道还要读哪些文件：章按 chapters 的顺序，文献列表 references.mdx 有没有由调用方看磁盘 */
export function mdxReportInputsOf(indexText: string, entry: string): { chapters: string[]; references: string } {
  const { chapters } = indexFrontmatterOf(parseMdx(indexText, entry), entry);
  return { chapters: chapters.map((chapter) => inDirectory(directoryOf(entry), chapter)), references: inDirectory(directoryOf(entry), MDX_REFERENCES_NAME) };
}

function referencesOf(context: CompileContext, root: MdastNode): NonNullable<ReportDocument['references']> {
  rejectFrontmatter(root as never, context.file, 'references.mdx ');
  const entries: NonNullable<ReportDocument['references']> = [];
  for (const node of root.children as MdastNode[]) {
    if (isCommentOnlyExpression(node)) continue;
    const element = node.type === 'paragraph' && node.children.length === 1 ? node.children[0] : node;
    if ((element.type !== 'mdxJsxFlowElement' && element.type !== 'mdxJsxTextElement') || element.name !== 'WordReference') failAt(context, node, 'references.mdx 里只能写 <WordReference id="…" url="…">著录文字</WordReference>，一条一段');
    const attributes = attributesOf(context, element, { id: 'required', url: 'optional' });
    const text = inlinesOf(context, phrasingChildrenOf(context, element));
    if (text.length !== 1 || text[0]!.type !== 'text' || text[0]!.marks) failAt(context, element, '<WordReference> 的著录文字只能是一行纯文字');
    const entry: NonNullable<ReportDocument['references']>[number] = { id: explicitIdOf(attributes['id']!, context.file, positionOf(element)), text: text[0]!.text };
    if (attributes['url'] !== undefined) entry.url = attributes['url'];
    entries.push(located(context, entry, element));
  }
  return entries;
}

function locationsByPointer(document: ReportDocument, locations: WeakMap<object, SourceLocation>) {
  const sources: Record<string, SourceLocation> = Object.create(null);
  const byPointer = new Map<string, SourceLocation>();
  for (const { node, pointer } of walk(document)) {
    const location = locations.get(node);
    if (!location) continue;
    byPointer.set(pointer, location);
    if (typeof node.id === 'string') sources[node.id] = location;
  }
  const locate = (pointer: string): SourceLocation | undefined => {
    for (let current = pointer; ; current = current.slice(0, current.lastIndexOf('/'))) {
      const location = byPointer.get(current);
      if (location) return location;
      if (!current) return undefined;
    }
  };
  return { sources, locate };
}

/** 整份 MDX 报告 → 一份 docreport 文档（入口正文在前，各章按 chapters 的顺序接在后面）；只解析、不执行 MDX */
export function compileMdxReport({ reportId, entry, files }: MdxReportInput): CompiledMdxReport {
  if (!/^[A-Za-z][A-Za-z0-9_-]{0,63}$/.test(reportId)) throw new ReportContentError(`报告目录名「${reportId}」不能当文档 id：MDX 报告的目录名要以字母开头`, entry);
  const textOf = (file: string) => {
    if (!Object.hasOwn(files, file)) throw new ReportContentError('找不到这个文件', file);
    return files[file]!;
  };
  const ids = new GeneratedIds();
  const locations = new WeakMap<object, SourceLocation>();
  const notes: NonNullable<ReportDocument['notes']> = [];
  const contextFor = (file: string, role: MdxFileRole): CompileContext => ({ file, role, ids, locations, notes });
  const indexRoot = parseMdx(textOf(entry), entry);
  const { metadata, chapters } = indexFrontmatterOf(indexRoot, entry);
  const blocks = sectionsOf(contextFor(entry, 'index'), indexRoot, 'decimal');
  const chapterFiles = chapters.map((chapter) => inDirectory(directoryOf(entry), chapter));
  for (const file of chapterFiles) {
    const root = parseMdx(textOf(file), file);
    blocks.push(...sectionsOf(contextFor(file, 'chapter'), root, chapterNumberingOf(root, file)));
  }
  const referencesFile = inDirectory(directoryOf(entry), MDX_REFERENCES_NAME);
  const hasReferences = Object.hasOwn(files, referencesFile);
  const references = hasReferences ? referencesOf(contextFor(referencesFile, 'references'), parseMdx(files[referencesFile]!, referencesFile)) : [];
  ids.assignAll();
  const document = { format: 'docreport', schemaVersion: 1, id: reportId, metadata, blocks } as ReportDocument;
  if (notes.length) document.notes = notes;
  if (references.length) document.references = references;
  return { document, ...locationsByPointer(document, locations), files: [entry, ...chapterFiles, ...(hasReferences ? [referencesFile] : [])] };
}

function rawMessageOf(error: ReportContentError): string {
  const prefix = `${error.file}${error.pointer ? ':' + error.pointer : ''}${error.file || error.pointer ? ': ' : ''}`;
  return error.message.startsWith(prefix) ? error.message.slice(prefix.length) : error.message;
}

/** 组装报的错指着编译结果里的 JSON 指针：换成 MDX 文件与行列再抛 */
function relocated(error: unknown, compiled: CompiledMdxReport, entry: string): unknown {
  if (!(error instanceof ReportContentError) || error.file !== entry) return error;
  const location = compiled.locate(error.pointer);
  return location ? new ReportContentError(rawMessageOf(error), location.file, location.pointer) : error;
}

/** 编译并组装一份 MDX 报告：结果和 JSON 报告的组装结果同形，sources 指向 MDX 的行列，dependencies 是编进来的 MDX 文件 */
export function assembleMdxReport(input: MdxReportInput, options: AssemblyOptions = {}): AssemblyResult {
  const compiled = compileMdxReport(input);
  let result: AssemblyResult;
  try {
    result = assembleDocument(input.entry, { [input.entry]: compiled.document }, options);
  } catch (error) {
    throw relocated(error, compiled, input.entry);
  }
  return { ...result, sources: { ...result.sources, ...compiled.sources }, dependencies: compiled.files };
}
