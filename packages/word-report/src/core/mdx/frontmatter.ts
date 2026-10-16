import type { Root } from 'mdast';
import { parse } from 'yaml';
import type { ReportDocument, Section } from '../types.ts';
import { ReportContentError } from '../types.ts';
import { positionOf } from './parse.ts';

type Fields = Record<string, unknown>;

function frontmatterOf(root: Root, file: string): { fields: Fields; at: string } | undefined {
  const node = root.children.find((child) => child.type === 'yaml');
  if (!node) return undefined;
  const at = positionOf(node);
  let value: unknown;
  try {
    value = parse((node as { value: string }).value, { uniqueKeys: true });
  } catch (error) {
    throw new ReportContentError(`文件头不是合法的 YAML：${(error as Error).message}`, file, at);
  }
  if (value === null || value === undefined) return { fields: {}, at };
  if (typeof value !== 'object' || Array.isArray(value)) throw new ReportContentError('文件头要写成「键: 值」的映射', file, at);
  return { fields: value as Fields, at };
}

function rejectUnknownKeys(fields: Fields, allowed: readonly string[], file: string, at: string) {
  for (const key of Object.keys(fields)) if (!allowed.includes(key)) throw new ReportContentError(`文件头认不出「${key}」：这里只能写 ${allowed.join('、')}`, file, at);
}

function stringField(fields: Fields, key: string, file: string, at: string): string | undefined {
  const value = fields[key];
  if (value === undefined) return undefined;
  if (typeof value !== 'string') throw new ReportContentError(`文件头的 ${key} 要是字符串`, file, at);
  return value;
}

function stringListField(fields: Fields, key: string, file: string, at: string): string[] | undefined {
  const value = fields[key];
  if (value === undefined) return undefined;
  if (!Array.isArray(value) || value.some((item) => typeof item !== 'string')) throw new ReportContentError(`文件头的 ${key} 要是字符串列表`, file, at);
  return value as string[];
}

const INDEX_KEYS = ['title', 'shortTitle', 'language', 'authors', 'date', 'revision', 'fields', 'chapters'] as const;

export interface IndexFrontmatter {
  metadata: ReportDocument['metadata'];
  /** 章文件名，相对报告目录，按接在入口正文后面的顺序 */
  chapters: string[];
}

/** 入口 index.mdx 的文件头：报告元数据与章节列表 */
export function indexFrontmatterOf(root: Root, file: string): IndexFrontmatter {
  const frontmatter = frontmatterOf(root, file);
  if (!frontmatter) throw new ReportContentError('index.mdx 要有文件头（--- 包起来的 YAML），至少写 title 与 language', file, '1:1');
  const { fields, at } = frontmatter;
  rejectUnknownKeys(fields, INDEX_KEYS, file, at);
  const title = stringField(fields, 'title', file, at);
  const language = stringField(fields, 'language', file, at);
  if (title === undefined) throw new ReportContentError('文件头缺少 title', file, at);
  if (language === undefined) throw new ReportContentError('文件头缺少 language（中文报告写 zh-CN）', file, at);
  const metadata: ReportDocument['metadata'] = { title, language };
  const shortTitle = stringField(fields, 'shortTitle', file, at);
  const authors = stringListField(fields, 'authors', file, at);
  const date = stringField(fields, 'date', file, at);
  const revision = stringField(fields, 'revision', file, at);
  if (shortTitle !== undefined) metadata.shortTitle = shortTitle;
  if (authors !== undefined) metadata.authors = authors;
  if (date !== undefined) metadata.date = date;
  if (revision !== undefined) metadata.revision = revision;
  if (fields['fields'] !== undefined) metadata.fields = metadataFieldsOf(fields['fields'], file, at);
  const chapters = stringListField(fields, 'chapters', file, at) ?? [];
  return { metadata, chapters: checkedChapterNames(chapters, file, at) };
}

function metadataFieldsOf(value: unknown, file: string, at: string): NonNullable<ReportDocument['metadata']['fields']> {
  const shapeError = new ReportContentError('文件头的 fields 要是列表，每项写 id、label、value 三个字符串', file, at);
  if (!Array.isArray(value)) throw shapeError;
  return value.map((item) => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) throw shapeError;
    const entry = item as Fields;
    if (Object.keys(entry).some((key) => !['id', 'label', 'value'].includes(key))) throw shapeError;
    const [id, label, fieldValue] = [entry['id'], entry['label'], entry['value']];
    if (typeof id !== 'string' || typeof label !== 'string' || typeof fieldValue !== 'string') throw shapeError;
    return { id, label, value: fieldValue };
  });
}

const RESERVED_FILE_NAMES = ['index.mdx', 'references.mdx'];

/** 章文件都放在报告目录根上：只收文件名，不收子目录与上级目录 */
function checkedChapterNames(chapters: string[], file: string, at: string): string[] {
  const seen = new Set<string>();
  for (const chapter of chapters) {
    if (!/^[^\\/:*?"<>|\x00-\x1f]+\.mdx$/.test(chapter) || chapter.startsWith('.')) throw new ReportContentError(`chapters 里的「${chapter}」要是报告目录根上的 .mdx 文件名，不带目录`, file, at);
    if (RESERVED_FILE_NAMES.includes(chapter)) throw new ReportContentError(`chapters 里不能写 ${chapter}`, file, at);
    if (seen.has(chapter)) throw new ReportContentError(`chapters 里「${chapter}」写了两次`, file, at);
    seen.add(chapter);
  }
  return chapters;
}

/** 章文件头只认 numbering，管这个文件里的一级标题；不写就是 decimal */
export function chapterNumberingOf(root: Root, file: string): Section['numbering'] {
  const frontmatter = frontmatterOf(root, file);
  if (!frontmatter) return 'decimal';
  const { fields, at } = frontmatter;
  rejectUnknownKeys(fields, ['numbering'], file, at);
  const numbering = stringField(fields, 'numbering', file, at) ?? 'decimal';
  if (numbering !== 'decimal' && numbering !== 'appendix' && numbering !== 'none') throw new ReportContentError(`numbering 只能是 decimal、appendix 或 none，这里写的是「${numbering}」`, file, at);
  return numbering;
}

export function rejectFrontmatter(root: Root, file: string, why: string): void {
  const node = root.children.find((child) => child.type === 'yaml');
  if (node) throw new ReportContentError(`${why}不写文件头`, file, positionOf(node));
}
