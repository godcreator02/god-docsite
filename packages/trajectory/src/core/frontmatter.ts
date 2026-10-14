/**
 * 卡文件头上的 frontmatter 与正文的切分，以及 frontmatter 的读法——命令行检查与站点的卡集合都经这里读，只有这一种读法。
 */

import { parse } from "yaml";

/** 头上的 frontmatter 块：`---` 一行开头、`---` 一行结束，块可以是空的；BOM 与 CRLF 都认 */
const FRONTMATTER_BLOCK = /^\uFEFF?---\r?\n(?:([\s\S]*?)\r?\n)?---[ \t]*(?:\r?\n|$)/;

/** frontmatter 读不成键值表：YAML 写坏了，或顶层不是键值表 */
export class FrontmatterError extends Error {
  override name = "FrontmatterError";
}

/** 剥掉 frontmatter，只留正文。 */
export function stripFrontmatter(text: string): string {
  return text.replace(FRONTMATTER_BLOCK, "");
}

/**
 * frontmatter 读成键值表。YAML 按 failsafe schema 解析：标量一律是字符串，`born-at: 2026-05-06` 不会变成 Date、
 * `label: 2026` 不会变成数字——日级 born-at 一旦被读成 Date，格式校验会把全部日级卡判成病卡挡在星轨盘外，而且不报错。
 * 没有 frontmatter 块回 null，块是空的回空表；YAML 写坏了、顶层不是键值表抛 FrontmatterError。
 */
export function parseFrontmatter(text: string): Record<string, unknown> | null {
  const block = FRONTMATTER_BLOCK.exec(text);
  if (block === null) return null;
  let parsed: unknown;
  try {
    parsed = parse(block[1] ?? "", { schema: "failsafe" });
  } catch (err) {
    throw new FrontmatterError(`frontmatter 不是合法的 YAML：${(err as Error).message.split("\n")[0]}`);
  }
  if (parsed === null) return {};
  if (typeof parsed !== "object" || Array.isArray(parsed)) throw new FrontmatterError("frontmatter 顶层须是「键: 值」的表");
  return parsed as Record<string, unknown>;
}
