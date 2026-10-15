/**
 * 组件源码里的钉码标记：.ts / .tsx / .mjs 文件，讲解组件里照源码抄来的数据在这里钉。哪些代码文件算文档由使用方定（docfirst 收页面旁边与站点 app/components/ 下的）。
 * 标记是单独一行的块注释 `/* ref file="…" lines="…" *\/`（前后可有空白），里面那一截跟 mdx 里的一字不差。
 * 不解析 TypeScript：按行认、按行写；一行里除了一个块注释还有别的代码，就不是标记。写回整行替换，保留缩进与行尾的 \r。
 */
import type { DocPin, PinFormat } from "./doc-pins.ts";
import { formalOf, markerErrors, parseFormal } from "./marker.ts";
import type { MemoRecord, Target } from "./types.ts";

/** 组件格式认领的扩展名 */
const EXTENSIONS = [".ts", ".tsx", ".mjs"];

/** 组件源码里的标记外壳：块注释 */
export const blockComment = (payload: string): string => `/* ${payload} */`;

export const codeMarker = (target: Target, record: MemoRecord | null): string => blockComment(formalOf(target, record));

/** 单独一行的块注释：前面的空白、注释里那一截。注释里不许再出现 *\/，一行两个注释不算 */
const COMMENT_LINE = /^(\s*)\/\*((?:(?!\*\/).)*)\*\/\s*$/;

function parse(text: string): DocPin[] {
  const pins: DocPin[] = [];
  const errors = markerErrors();
  text.split("\n").forEach((raw, index) => {
    const comment = COMMENT_LINE.exec(raw.replace(/\r$/, ""));
    if (comment === null) return;
    const line = index + 1;
    const parsed = errors.attempt(() => parseFormal(comment[2]!, `第 ${line} 行`));
    if (parsed !== null) pins.push({ ...parsed, line });
  });
  errors.throwIfAny();
  return pins;
}

function write(text: string, written: Array<{ line: number; target: Target; record: MemoRecord }>): string {
  const lines = text.split("\n");
  for (const { line, target, record } of written) {
    const was = lines[line - 1]!;
    const indent = /^\s*/.exec(was)![0];
    lines[line - 1] = indent + codeMarker(target, record) + (was.endsWith("\r") ? "\r" : "");
  }
  return lines.join("\n");
}

export const codeFormat: PinFormat = {
  name: "组件格式",
  claims: (file) => EXTENSIONS.some((ext) => file.endsWith(ext)),
  parse,
  write,
};
