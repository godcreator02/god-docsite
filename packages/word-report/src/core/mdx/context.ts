import type { ReportDocument, SourceLocation } from '../types.ts';
import { ReportContentError } from '../types.ts';
import type { GeneratedIds } from './ids.ts';
import { positionOf } from './parse.ts';

/** 一个 MDX 文件在报告里的角色：入口、章、文献列表；几样只能写在特定文件里的东西按它判断 */
export type MdxFileRole = 'index' | 'chapter' | 'references';

export interface CompileContext {
  file: string;
  role: MdxFileRole;
  ids: GeneratedIds;
  /** 每个生成的 docreport 节点对应的 MDX 位置：组装报错时按它换回源文件的行列 */
  locations: WeakMap<object, SourceLocation>;
  notes: NonNullable<ReportDocument['notes']>;
}

export type MdastNode = { type: string; position?: { start: { line: number; column: number } }; [key: string]: any };

export function located<T extends object>(context: CompileContext, node: T, source: MdastNode): T {
  context.locations.set(node, { file: context.file, pointer: positionOf(source) });
  return node;
}

export function failAt(context: CompileContext, source: MdastNode, message: string): never {
  throw new ReportContentError(message, context.file, positionOf(source));
}

/** 只含注释的花括号表达式（MDX 里写注释的唯一办法）：解析后的程序体是空的 */
export function isCommentOnlyExpression(node: MdastNode): boolean {
  return (node.type === 'mdxFlowExpression' || node.type === 'mdxTextExpression') && node.data?.estree?.body?.length === 0;
}
