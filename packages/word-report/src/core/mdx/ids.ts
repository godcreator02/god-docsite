import { stableValue } from '../validate.ts';
import { ReportContentError } from '../types.ts';

const ID_PATTERN = /^[A-Za-z][A-Za-z0-9_-]{0,63}$/;
/** 编译器生成的 id 都以它开头；手写的 id 不许用，两边就不会撞 */
export const GENERATED_ID_PREFIX = 'auto-';

export type GeneratedIdKind =
  | 'sec' | 'p' | 'list' | 'li' | 'fig' | 'panel' | 'tbl' | 'row' | 'col' | 'cell'
  | 'eq' | 'code' | 'm' | 'ref' | 'link' | 'cite' | 'fn' | 'abs' | 'bib';

/** 手写的 id：规则照 docreport，另外不许占用生成 id 的前缀 */
export function explicitIdOf(raw: string, file: string, at: string): string {
  if (!ID_PATTERN.test(raw)) throw new ReportContentError(`id「${raw}」不合规则：要以字母开头，只用字母、数字、_ 与 -，最长 64 个字符`, file, at);
  if (raw.startsWith(GENERATED_ID_PREFIX)) throw new ReportContentError(`id「${raw}」以 ${GENERATED_ID_PREFIX} 开头：这个前缀留给编译器生成的 id，手写的 id 换个名字`, file, at);
  return raw;
}

function fnv1a36(text: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(36);
}

function withoutIds(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(withoutIds);
  if (value && typeof value === 'object') {
    const copy: Record<string, unknown> = {};
    for (const [key, child] of Object.entries(value)) if (key !== 'id') copy[key] = withoutIds(child);
    return copy;
  }
  return value;
}

/**
 * 没写 id 的节点先登记，整份文档转完后一次分配：`auto-<种类>-<指纹>`，指纹取种类加去掉所有 id 的节点内容
 * （节只取标题：节里改了字，标题的锚点与目录链接不跟着变），同一份内容每次编译得到同一个 id；内容相同的按登记先后加 -2、-3
 */
export class GeneratedIds {
  private readonly pending: { node: { id?: string }; kind: GeneratedIdKind; signature: unknown }[] = [];

  /** signature 不给就用整个节点（去掉 id）；登记时节点的子内容可以还没填完，分配时才取指纹 */
  request<T extends { id?: string }>(node: T, kind: GeneratedIdKind, signature?: unknown): T {
    this.pending.push({ node, kind, signature });
    return node;
  }

  assignAll(): void {
    const occurrences = new Map<string, number>();
    for (const { node, kind, signature } of this.pending) {
      const base = `${GENERATED_ID_PREFIX}${kind}-${fnv1a36(`${kind}:${stableValue(withoutIds(signature ?? node))}`)}`;
      const occurrence = (occurrences.get(base) ?? 0) + 1;
      occurrences.set(base, occurrence);
      node.id = occurrence === 1 ? base : `${base}-${occurrence}`;
    }
  }
}
