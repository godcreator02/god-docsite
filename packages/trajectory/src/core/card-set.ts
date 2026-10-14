/**
 * 一批卡 → 星轨盘的中性输入加病卡清单。纯函数：卡从哪儿来由调用方定——命令行读卡目录（node/scan.ts），
 * 站点从卡集合每一页的数据取（site/disk.server.ts），两边汇总走的都是 assembleCardSet。
 * 根卡恰好一张时它是盘心；born-at 合格的非根卡全部画上星轨盘，有病但画得出来的照样画上去。
 */

import { readCardFile } from "./card.ts";
import { validBornAt } from "./model/build.ts";
import type { DiskCard, DiskCenter } from "./model/types.ts";
import { CARD_EXT, pickCardFiles } from "./card-files.ts";
import type { CardFile, CardFileReading, CardRecord, CardScan, Problem, SickFile } from "./types.ts";

interface PlacedProblem {
  path: string;
  problem: Problem;
}

/**
 * 一批已经单独读过的卡文件汇总成中性输入与病卡。同一身份已有 `.mdx` 的 `.md` 跳过、病记在 `.mdx` 上；
 * 每个文件先列单文件的病，再追加跨文件的病（根卡、parent、关系指向、同身份两个文件），最后是正文里的钉码记号。
 * 病卡按路径排序，卡按身份排序，同一批文件两次汇总产物逐位相等。
 */
export function assembleCardSet(readings: readonly CardFileReading[]): CardScan {
  const names = readings.map((reading) => reading.name);
  const kept = new Set(pickCardFiles(names));
  const keptReadings = readings.filter((reading) => kept.has(reading.name));
  const records = keptReadings.flatMap((reading) => (reading.card === null ? [] : [reading.card])).sort((a, b) => a.id.localeCompare(b.id));
  const problemsByPath = new Map<string, Problem[]>(keptReadings.map((reading) => [reading.name, [...reading.problems]]));
  const crossFile = [...crossFileProblems(records), ...relationProblems(records), ...duplicateFileProblems(names, kept)];
  for (const { path, problem } of crossFile) (problemsByPath.get(path) as Problem[]).push(problem);
  for (const reading of keptReadings) (problemsByPath.get(reading.name) as Problem[]).push(...reading.pinMarkProblems);
  const sick: SickFile[] = [...problemsByPath]
    .filter(([, problems]) => problems.length > 0)
    .map(([path, problems]) => ({ path, problems }))
    .sort((a, b) => a.path.localeCompare(b.path));
  return { ...diskInputOf(records), sick };
}

/** 一批卡文件扫成中性输入与病卡。目录内平铺，名字不带路径；不是卡文件后缀的名字跳过。 */
export function scanCards(files: readonly CardFile[]): CardScan {
  return assembleCardSet(files.filter((file) => CARD_EXT.test(file.name)).map((file) => readCardFile(file.name, file.text)));
}

/** 记录换成星轨盘的中性输入：根卡恰好一张时它是盘心，born-at 格式不对的盘心不给时刻；
 * 非根卡只收 born-at 合格的（算不出半径的画不出来），别的病不影响画上星轨盘。 */
function diskInputOf(records: readonly CardRecord[]): { center: DiskCenter | null; cards: DiskCard[] } {
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
function crossFileProblems(records: readonly CardRecord[]): PlacedProblem[] {
  const out: PlacedProblem[] = [];
  const roots = records.filter((c) => c.type === "root");
  if (roots.length > 1) {
    const reason = `卡目录里有 ${roots.length} 张根卡（${roots.map((r) => r.id).join("、")}），只能有一张`;
    for (const r of roots) out.push({ path: r.path, problem: { field: "type", value: "root", reason } });
  }
  for (const r of roots) {
    if (r.parent.length) out.push({ path: r.path, problem: { field: "parent", value: r.parent.join(","), reason: "根卡不写 parent" } });
  }
  if (roots.length > 1) return out;
  const rootId = roots.length === 1 ? (roots[0] as CardRecord).id : null;
  for (const c of records) {
    if (c.type === "root") continue;
    for (const v of c.parent) {
      if (v === rootId) continue;
      const reason = rootId === null ? "parent 须指向根卡，但卡目录里没有根卡" : `parent 须是根卡的身份 ${rootId}`;
      out.push({ path: c.path, problem: { field: "parent", value: v, reason } });
    }
  }
  return out;
}

/** 关系只能指向星轨盘上的卡：指向根卡的报（根卡代表整个项目，关系要指向具体的卡），指向不存在的卡、
 * 或 born-at 格式不对、没画上星轨盘的卡也报。根卡自己写的关系不画，不查。 */
function relationProblems(records: readonly CardRecord[]): PlacedProblem[] {
  const out: PlacedProblem[] = [];
  const rootIds = new Set(records.filter((r) => r.type === "root").map((r) => r.id));
  const onDisk = new Set(records.filter((r) => r.type !== "root" && validBornAt(r.bornAt)).map((r) => r.id));
  for (const r of records) {
    if (r.type === "root") continue;
    for (const rel of r.relations) {
      const key = rel.kind === "supersede" ? "supersedes" : "pivots-from";
      if (rootIds.has(rel.target)) {
        const reason = `${key}:: 指向了根卡：根卡代表整个项目，关系要指向具体的卡`;
        out.push({ path: r.path, problem: { field: "relation", value: rel.target, reason } });
      } else if (!onDisk.has(rel.target)) {
        const reason = `${key}:: 指向的卡不在盘上：没有这张卡，或它的 born-at 写坏了`;
        out.push({ path: r.path, problem: { field: "relation", value: rel.target, reason } });
      }
    }
  }
  return out;
}

/** 同一身份 `.md` 与 `.mdx` 两个文件都在：只认 `.mdx`，病记在 `.mdx` 那个文件上。 */
function duplicateFileProblems(names: readonly string[], kept: ReadonlySet<string>): PlacedProblem[] {
  const all = new Set(names);
  const out: PlacedProblem[] = [];
  for (const name of kept) {
    const shadowed = name.replace(/\.mdx$/, ".md");
    if (shadowed === name || !all.has(shadowed)) continue;
    const reason = `同一身份还有一个 ${shadowed}：只认 .mdx，删掉或改名那一份`;
    out.push({ path: name, problem: { field: "file", value: shadowed, reason } });
  }
  return out;
}
