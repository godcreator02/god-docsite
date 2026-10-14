/**
 * 组件格式：站的 `src/components/` 下的 .ts / .tsx / .mjs，讲解组件里照源码抄来的数据在这里写引用。
 * 记号是单独一行的块注释 `/* ref file="…" lines="…" *\/`（前后可有空白），里面那一截跟 mdx 里的一字不差，
 * 由记号写法（`../marker/`）解析；写回整行替换，保留缩进与行尾的 \r。
 * 不解析 TypeScript：记号就是一行注释，按行认、按行写。一行里除了一个块注释还有别的代码，就不是记号。
 *
 * 这个目录只认识 `../marker/` 与 `../reference/`，不认识 mdx、钉码编排、project 与 cli（由 `tests/boundary.test.ts` 检查）。
 */
import type { MemoRecord, Target } from "../legacy-code-pin/index.ts";
import type { Format, Reference, WrittenReference } from "../reference/index.ts";
import { formalOf, markerErrors, parseFormal } from "../marker/index.ts";

/** 组件格式认领的目录（相对项目根，也就是站目录）与扩展名 */
export const COMPONENTS_DIR = "src/components/";
const EXTENSIONS = [".ts", ".tsx", ".mjs"];

/** 组件里的记号外壳：块注释 */
export const blockComment = (payload: string): string => `/* ${payload} */`;

/** 记号：块注释包着记号写法定的那一截；还没确认的 record 是 null，不带记录属性 */
export const marker = (target: Target, record: MemoRecord | null): string => blockComment(formalOf(target, record));

/** 单独一行的块注释：前面的空白、注释里那一截。注释里不许再出现 *\/，一行两个注释不算 */
const COMMENT_LINE = /^(\s*)\/\*((?:(?!\*\/).)*)\*\/\s*$/;

export function claims(file: string): boolean {
  return file.startsWith(COMPONENTS_DIR) && EXTENSIONS.some((ext) => file.endsWith(ext));
}

/** 认出全部记号；写错的记号一次列全再报错 */
export function parse(text: string): Reference[] {
  const refs: Reference[] = [];
  const errors = markerErrors();
  text.split("\n").forEach((raw, index) => {
    const comment = COMMENT_LINE.exec(raw.replace(/\r$/, ""));
    if (comment === null) return;
    const parsed = errors.attempt(() => parseFormal(comment[2]!, `第 ${index + 1} 行`, blockComment));
    if (parsed !== null) refs.push({ ...parsed, at: index });
  });
  errors.throwIfAny();
  return refs;
}

export function write(text: string, written: WrittenReference[]): string {
  const lines = text.split("\n");
  for (const { target, record, at } of written) {
    const line = lines[at]!;
    const indent = /^\s*/.exec(line)![0];
    lines[at] = indent + marker(target, record) + (line.endsWith("\r") ? "\r" : "");
  }
  return lines.join("\n");
}

export const codeFormat: Format = { name: "组件格式", claims, parse, write };
