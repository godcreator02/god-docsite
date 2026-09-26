/**
 * 一批卡文件 → 扫盘产物。纯函数：文件从哪儿来（读盘、内存、网络）由调用方定，
 * 这里只挑卡文件、逐张解析、按身份排序。读目录的那一半在 `@godcreator/docfirst-workflow`
 * 的 `scanCardDir`。
 * 逻辑出自老仓 `god-flow-panels` 的 `node/star/model.ts`（只读参考，本仓不 import 它）。
 */

import { parseCardFile } from "./model.ts";
import type { Problem, RawCard, SickFile } from "./types.ts";

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
 * 不是卡文件的名字、同主干被 `.mdx` 盖掉的 `.md` 都跳过；每张卡先报单文件的病，
 * 再跑跨文件的校验（crossFileProblems）追加在后面。产物按身份、按路径排序，
 * 同一批文件两次扫描产物逐位相等。 */
export function scanCards(files: readonly CardFile[]): TrajectoryScan {
  const byName = new Map(files.map((file) => [file.name, file]));
  const cards: RawCard[] = [];
  const problemsByPath = new Map<string, Problem[]>();
  for (const name of pickCardFiles([...byName.keys()])) {
    const file = byName.get(name)!;
    const id = name.replace(CARD_EXT, "");
    const parsed = parseCardFile(id, name, file.mtime, file.text);
    if (!parsed.card) continue;
    cards.push(parsed.card);
    problemsByPath.set(parsed.card.path, [...parsed.problems]);
  }
  cards.sort((a, b) => a.id.localeCompare(b.id));
  for (const { path, problem } of crossFileProblems(cards)) problemsByPath.get(path)!.push(problem);
  const sick: SickFile[] = [...problemsByPath]
    .filter(([, problems]) => problems.length > 0)
    .map(([path, problems]) => ({ path, problems }))
    .sort((a, b) => a.path.localeCompare(b.path));
  return { cards, sick };
}

/** 跨文件的一致性校验：卡目录里只有一张根卡，根卡不写 parent，非根卡的 parent 每个值都是那张根卡的身份。
 * 根卡多于一张时不查非根卡的 parent：没有唯一的根卡可比，先把根卡减到一张。 */
function crossFileProblems(cards: readonly RawCard[]): Array<{ path: string; problem: Problem }> {
  const out: Array<{ path: string; problem: Problem }> = [];
  const roots = cards.filter((c) => c.type === "root");
  if (roots.length > 1) {
    const reason = `卡目录里有 ${roots.length} 张根卡（${roots.map((r) => r.id).join("、")}），只能有一张`;
    for (const r of roots) out.push({ path: r.path, problem: { field: "type", value: "root", reason } });
  }
  for (const r of roots) {
    if (r.parent.length) {
      out.push({ path: r.path, problem: { field: "parent", value: r.parent.join(","), reason: "根卡不写 parent" } });
    }
  }
  if (roots.length > 1) return out;
  const rootId = roots.length === 1 ? (roots[0] as RawCard).id : null;
  for (const c of cards) {
    if (c.type === "root") continue;
    for (const v of c.parent) {
      if (v === rootId) continue;
      const reason =
        rootId === null ? "parent 须指向根卡，但卡目录里没有根卡" : `parent 须是根卡的身份 ${rootId}`;
      out.push({ path: c.path, problem: { field: "parent", value: v, reason } });
    }
  }
  return out;
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
