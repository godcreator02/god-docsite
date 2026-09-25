/**
 * 一批卡文件 → 扫盘产物。纯函数：文件从哪儿来（读盘、内存、网络）由调用方定，
 * 这里只挑卡文件、逐张解析、按身份排序。读目录的那一半在 `@godcreator/docfirst-workflow`
 * 的 `scanCardDir`。
 * 逻辑出自老仓 `god-flow-panels` 的 `node/star/model.ts`（只读参考，本仓不 import 它）。
 */

import { parseCardFile } from "./model.ts";
import type { RawCard, SickFile } from "./types.ts";

/** 扫盘产物：全部卡 + 按文件归拢的报病。 */
export interface TrajectoryScan {
  cards: RawCard[];
  sick: SickFile[];
}

/** 一个卡文件：`name` 是卡目录里的文件名（卡上记的 `path` 就是它），`mtime` 是毫秒时间戳。 */
export interface CardFile {
  name: string;
  text: string;
  mtime: number;
}

/** 卡文件的后缀：`.mdx` 是六区站 `content/trajectory/` 里的正体（卡进 fumadocs 集合渲成页），
 * `.md` 是把卡摆在站外某个目录的项目的写法——两种都认，卡身份都是去掉后缀的文件名主干。
 * 同一主干两种后缀都在时只认 `.mdx`（`.md` 那份跳过）：身份撞车不该静默出两张卡。 */
const CARD_EXT = /\.mdx?$/;

/** 一批卡文件扫成卡与报病。目录内平铺不建子目录（card-format 正本已定），名字不带路径。
 * 不是卡文件的名字、同主干被 `.mdx` 盖掉的 `.md` 都跳过；产物按身份、按路径排序，
 * 同一批文件两次扫描产物逐位相等。 */
export function scanCards(files: readonly CardFile[]): TrajectoryScan {
  const byName = new Map(files.map((file) => [file.name, file]));
  const cards: RawCard[] = [];
  const sick: SickFile[] = [];
  for (const name of pickCardFiles([...byName.keys()])) {
    const file = byName.get(name)!;
    const id = name.replace(CARD_EXT, "");
    const parsed = parseCardFile(id, name, file.mtime, file.text);
    if (!parsed.card) continue;
    cards.push(parsed.card);
    if (parsed.problems.length) sick.push({ path: parsed.card.path, problems: parsed.problems });
  }
  cards.sort((a, b) => a.id.localeCompare(b.id));
  sick.sort((a, b) => a.path.localeCompare(b.path));
  return { cards, sick };
}

/** 目录名单里挑出卡文件：`.md` / `.mdx` 都要，同一主干两者都在只留 `.mdx`；排过序。 */
export function pickCardFiles(names: readonly string[]): string[] {
  const byStem = new Map<string, string>();
  for (const name of [...names].sort()) {
    if (!CARD_EXT.test(name)) continue;
    const stem = name.replace(CARD_EXT, "");
    const kept = byStem.get(stem);
    if (kept === undefined || (kept.endsWith(".md") && name.endsWith(".mdx"))) byStem.set(stem, name);
  }
  return [...byStem.values()].sort();
}
