import type { Root } from 'mdast';
import remarkFrontmatter from 'remark-frontmatter';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import remarkMdx from 'remark-mdx';
import remarkParse from 'remark-parse';
import { unified } from 'unified';
import { ReportContentError } from '../types.ts';

const mdxParser = unified().use(remarkParse).use(remarkFrontmatter, ['yaml']).use(remarkMdx).use(remarkGfm).use(remarkMath);

/** 源位置写成「行:列」，放在 ReportContentError 的 pointer 里 */
export const positionOf = (node: { position?: { start: { line: number; column: number } } }): string =>
  node.position ? `${node.position.start.line}:${node.position.start.column}` : '';

/** 只解析、不执行 MDX：标签没闭合、正文里裸的 < 与 { 这类语法错在这里报出，补上文件与行列再抛 */
export function parseMdx(text: string, file: string): Root {
  try {
    return mdxParser.parse(text) as Root;
  } catch (error) {
    const place = error as { reason?: string; line?: number; column?: number; message?: string };
    const at = place.line ? `${place.line}:${place.column ?? 1}` : '';
    throw new ReportContentError(`MDX 语法错误：${place.reason ?? place.message ?? String(error)}`, file, at);
  }
}
