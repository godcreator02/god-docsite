/**
 * 一批卡文件 → 星轨盘的中性输入加病卡清单。纯函数：文件从哪儿来（读盘、内存）由调用方定，读卡目录在 card-dir.ts。
 * 根卡恰好一张时它是盘心；born-at 合格的非根卡全部上盘，有病但画得出来的照样上盘。
 * 逻辑出自老仓 `god-flow-panels` 的 `node/star/model.ts`（只读参考，本仓不 import 它）。
 */

import { validBornAt } from "@godcreator/docfirst-trajectory";
import type { DiskCard, DiskCenter } from "@godcreator/docfirst-trajectory";
import { parseCardFile } from "./card.ts";
import { checkDocfirstRefs } from "./card-refs.ts";
import { stripFrontmatter } from "./parse.ts";
import type { CardFile, CardRecord, CardScan, Problem, SickFile } from "./types.ts";

/** 卡文件的后缀：`.mdx` 是文档站 `content/trajectory/` 里的写法（卡进 fumadocs 集合渲成页），
 * `.md` 是把卡摆在站外某个目录的项目的写法——两种都认，卡身份都是去掉后缀的文件名。
 * 同一身份两种后缀都在时只认 `.mdx`（`.md` 那份跳过）：身份撞车不该出两张卡。 */
const CARD_EXT = /\.mdx?$/;

/** 一批卡文件扫成中性输入与病卡。目录内平铺，名字不带路径。不是卡文件的名字、同身份被 `.mdx` 盖掉的 `.md` 都跳过；
 * 每张卡先报单文件的病，再跑跨文件的校验，再查正文里有没有钉码记号。病卡按路径排序，卡按身份排序，
 * 同一批文件两次扫描产物逐位相等。 */
export function scanCards(files: readonly CardFile[]): CardScan {
  const byName = new Map(files.map((file) => [file.name, file]));
  const records: CardRecord[] = [];
  const problemsByPath = new Map<string, Problem[]>();
  for (const name of pickCardFiles([...byName.keys()])) {
    const parsed = parseCardFile(name.replace(CARD_EXT, ""), name, (byName.get(name) as CardFile).text);
    if (!parsed.card) continue;
    records.push(parsed.card);
    problemsByPath.set(name, [...parsed.problems]);
  }
  records.sort((a, b) => a.id.localeCompare(b.id));
  for (const { path, problem } of crossFileProblems(records)) (problemsByPath.get(path) as Problem[]).push(problem);
  for (const record of records) {
    const text = (byName.get(record.path) as CardFile).text;
    (problemsByPath.get(record.path) as Problem[]).push(...checkDocfirstRefs(stripFrontmatter(text)));
  }
  const sick: SickFile[] = [...problemsByPath]
    .filter(([, problems]) => problems.length > 0)
    .map(([path, problems]) => ({ path, problems }))
    .sort((a, b) => a.path.localeCompare(b.path));
  return { ...toDiskInput(records), sick };
}

/** 记录换成星轨盘的中性输入：根卡恰好一张时它是盘心，born-at 写坏的盘心不给时刻；
 * 非根卡只收 born-at 合格的（算不出半径的画不出来），其余的病不挡上盘。 */
function toDiskInput(records: readonly CardRecord[]): { center: DiskCenter | null; cards: DiskCard[] } {
  const roots = records.filter((r) => r.type === "root");
  const root = roots.length === 1 ? (roots[0] as CardRecord) : null;
  const center: DiskCenter | null = root
    ? {
        id: root.id,
        label: root.label,
        bornAt: validBornAt(root.bornAt) ? root.bornAt : null,
        kind: root.type,
        milestones: root.milestones ?? [],
      }
    : null;
  const cards = records
    .filter((r) => r.type !== "root" && validBornAt(r.bornAt))
    .map(
      (r): DiskCard => ({
        id: r.id,
        bornAt: r.bornAt,
        label: r.label,
        domain: r.domain,
        kind: r.type,
        relations: r.relations,
      }),
    );
  return { center, cards };
}

/** 跨文件的一致性校验：卡目录里只有一张根卡，根卡不写 parent，非根卡的 parent 每个值都是那张根卡的身份。
 * 根卡多于一张时不查非根卡的 parent：没有唯一的根卡可比，先把根卡减到一张。 */
function crossFileProblems(records: readonly CardRecord[]): Array<{ path: string; problem: Problem }> {
  const out: Array<{ path: string; problem: Problem }> = [];
  const roots = records.filter((c) => c.type === "root");
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
  const rootId = roots.length === 1 ? (roots[0] as CardRecord).id : null;
  for (const c of records) {
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

/** 目录名单里挑出卡文件：`.md` / `.mdx` 都要，同一身份两者都在只留 `.mdx`；排过序。 */
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
