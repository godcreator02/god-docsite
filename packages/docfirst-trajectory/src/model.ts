/**
 * 由卡目录建模：一个卡目录一张盘。认根靠 `type: root`，卡目录里恰好一张根卡时它是盘心；
 * born-at 合格的非根卡全部上盘（`parent` 由 scanCards 校验，不决定上不上盘；`domain` 只是泳道分组）；
 * 时间轴吃 `born-at`（分钟级 `YYYY-MM-DDTHH:mm`，日级 `YYYY-MM-DD` 兼容）；
 * 关系边是正文 inline field（`supersedes::` / `pivots-from::`，链接目标即卡身份，
 * md link 与 wikilink 两形态都认）；
 * 根卡不上盘（盘心圆盘即根卡），诞生时刻只参与定盘界；里程碑从根卡正文「## 里程碑」解析。
 *
 * 纯函数，不碰文件系统——读卡目录在 `@godcreator/docfirst-workflow` 的 `scanCardDir`，
 * 这个包一句 import 外部模块都没有。`scanCards` 出 `RawCard[]`，本文件的建模函数只吃它。
 * 报病按文件归拢成 `SickFile`。
 * 逻辑出自老仓 `god-flow-panels` 的 `node/star/model.ts`（只读参考，本仓不 import 它）。
 */

import {
  CARD_KEYS,
  extractMilestones,
  extractRelations,
  type Frontmatter,
  listOf,
  parseFrontmatter,
  scalarOf,
  stripFrontmatter,
} from "./parse.ts";
import type { Card, Edge, BrokenRel, Problem, ProjectRoot, RawCard, TrajectoryModel, Tree } from "./types.ts";

/** 「未分道」隐式组的哨兵值：无 domain 的卡归进这组——着中性色（盘心色一档）、
 * 排各泳道组之后、不占领域色板。拿字符串当 domain 用是为了装箱 / 筛选 / 图例
 * 一条链路不加特例；规范层面不会起这个领域名。 */
export const NO_DOMAIN = "未分道";

/** born-at 合法形状：分钟级 YYYY-MM-DDTHH:mm，存量日级 YYYY-MM-DD 兼容。 */
const BORN_AT_RE = /^\d{4}-\d{2}-\d{2}(?:T\d{2}:\d{2})?$/;

/** 卡身份的前置日期段：`<YYYY-MM-DD>-<slug>`，剥掉它剩下的就是 title。 */
const ID_DATE_PREFIX = /^\d{4}-\d{2}-\d{2}-/;

/** 日期字符串转天序数——取日期部分强制 UTC 解析，序数是精确整数、零时区依赖。
 * 日级与分钟级两种长度都只吃前 10 位，天然兼容。 */
export function dayNum(d: string): number {
  return Date.parse(`${d.slice(0, 10)}T00:00:00Z`) / 86400000;
}

/** 天序数转 MM-DD 显示。 */
export function formatDay(n: number): string {
  return new Date(n * 86400000).toISOString().slice(5, 10);
}

/** 卡的盘上形态：有取代出边（supersedes 链上被人取代）即「被取代」，否则「在立」。
 * 根卡不在其列——它不上盘，盘心圆盘就是它。 */
export function formOf(
  model: Pick<TrajectoryModel, "supersededIds">,
  id: string,
): "alive" | "superseded" {
  return model.supersededIds.has(id) ? "superseded" : "alive";
}

/** born-at 形状 + 可解析双查（分钟级与日级两种长度合法）。 */
function bornAtOk(v: string): boolean {
  return BORN_AT_RE.test(v) && !Number.isNaN(dayNum(v));
}

/** 身份去掉前置日期段就是 title（label 读不到时的兜底）；没有日期段的身份原样当 title。 */
function titleOf(id: string): string {
  return id.replace(ID_DATE_PREFIX, "");
}

/* ================= 扫盘：一趟读完，后续全在内存上算 ================= */

/** 一个文件解析出的卡与它自己的病。不是卡（卡体系字段一个都不沾）时 card 为 null。 */
export interface ParsedFile {
  card: RawCard | null;
  problems: Problem[];
}

/** 把一份卡文件的全文变成 RawCard，顺带跑单文件的校验（born-at 形状、必填字段、关系行形）。
 * 一致性校验（根卡几张、parent 指不指向根卡）跨文件，在 scanCards 里。
 * 「卡正文里不许钉码」是钉码那一侧的规矩，由 `@godcreator/docfirst-workflow` 读卡目录时另加。
 * 卡体系字段（CARD_KEYS）一个都不沾的文件不是卡：card 与 problems 都回空，整文件跳过。 */
export function parseCardFile(id: string, path: string, mtime: number, text: string): ParsedFile {
  const fm: Frontmatter | null = parseFrontmatter(text);
  if (!fm || !CARD_KEYS.some((k) => fm[k] !== undefined)) return { card: null, problems: [] };

  const title = titleOf(id);
  const bornAt = scalarOf(fm, "born-at") ?? "";
  const type = scalarOf(fm, "type");
  const parent = listOf(fm, "parent");
  const domain = scalarOf(fm, "domain");
  const rawLabel = scalarOf(fm, "label");
  const isRoot = type === "root";

  const problems: Problem[] = [];
  const bad = (field: Problem["field"], value: string, reason: string): void => {
    problems.push({ field, value, reason });
  };

  /* 存在性校验：born-at / label 全卡必填；parent 非根卡必填（根卡不写 parent 由 scanCards 查） */
  if (!bornAt) bad("born-at", "", "缺 born-at（全卡必填）");
  else if (!bornAtOk(bornAt)) {
    bad("born-at", bornAt, "born-at 格式须 YYYY-MM-DD 或 YYYY-MM-DDTHH:mm");
  }
  if (!isRoot && !parent.length) bad("parent", "", "缺 parent（非根卡必填，写根卡的身份）");
  if (rawLabel === null || rawLabel.trim() === "") {
    bad("label", rawLabel ?? "", "缺 label（全卡必填）");
  }

  const body = stripFrontmatter(text);
  const { relations, broken } = extractRelations(body);
  /* 行头是关系字段却写歪了：文件级病，示众——静默吞行有过前科 */
  for (const b of broken) {
    bad("relation", b.target, `${b.key}:: 后须是 [文字](卡身份.md) 形态的一行`);
  }

  return {
    card: {
      id,
      title,
      path,
      mtime,
      type,
      parent,
      domain,
      label: rawLabel?.trim() || title,
      status: scalarOf(fm, "status"),
      bornAt,
      relations,
      milestones: isRoot ? extractMilestones(body) : null,
    },
    problems,
  };
}

/* ================= 上盘 ================= */

function toCard(raw: RawCard): Card {
  return {
    id: raw.id,
    title: raw.title,
    domain: raw.domain?.trim() || NO_DOMAIN,
    bornAt: raw.bornAt,
    label: raw.label,
    path: raw.path,
  };
}

/** 上盘卡：非根卡里 born-at 合格的全部（born-at 坏的半径标度一路 NaN，病已进 sick，这里只挡不收；
 * 其余字段病不挡渲染）。字典序即时间序（同刻日级排在分钟级前），并列按身份收尾。 */
function collectCards(all: readonly RawCard[]): Card[] {
  return all
    .filter((c) => c.type !== "root" && bornAtOk(c.bornAt))
    .map(toCard)
    .sort((a, b) => a.bornAt.localeCompare(b.bornAt) || a.id.localeCompare(b.id));
}

/* ================= 关系边与树 ================= */

/** 求解正文关系边：目标在盘上卡集合里的成边，不在的收进坏关系示众。 */
function collectEdges(
  all: readonly RawCard[],
  cards: readonly Card[],
  byId: Record<string, Card>,
): { edges: Edge[]; broken: BrokenRel[] } {
  const rawById = new Map(all.map((c) => [c.id, c]));
  const edges: Edge[] = [];
  const broken: BrokenRel[] = [];
  for (const c of cards) {
    const raw = rawById.get(c.id);
    if (!raw) continue;
    for (const rel of raw.relations) {
      if (byId[rel.target]) edges.push({ from: rel.target, to: c.id, kind: rel.kind });
      else {
        broken.push({
          id: c.id,
          key: rel.kind === "supersede" ? "supersedes" : "pivots-from",
          target: rel.target,
        });
      }
    }
  }
  return { edges, broken };
}

/** 树提取：分量收取代与转向两种边——同一摊事该占同一块地，转向卡跟长出它的那张同树。 */
function extractTrees(
  cards: readonly Card[],
  edges: readonly Edge[],
  byId: Record<string, Card>,
): { trees: Tree[]; isolated: Card[]; compOf: Record<string, string> } {
  const supIn: Record<string, string[]> = {};
  const supOut: Record<string, string[]> = {};
  const pivIn: Record<string, string[]> = {};
  const pivOut: Record<string, string[]> = {};
  for (const c of cards) {
    supIn[c.id] = [];
    supOut[c.id] = [];
    pivIn[c.id] = [];
    pivOut[c.id] = [];
  }
  for (const e of edges) {
    if (e.kind === "supersede") {
      supIn[e.to]?.push(e.from);
      supOut[e.from]?.push(e.to);
    } else {
      pivIn[e.to]?.push(e.from);
      pivOut[e.from]?.push(e.to);
    }
  }
  const neighborsOf = (id: string): string[] => [
    ...(supOut[id] ?? []),
    ...(supIn[id] ?? []),
    ...(pivOut[id] ?? []),
    ...(pivIn[id] ?? []),
  ];

  const compOf: Record<string, string> = {};
  for (const c of cards) {
    if (compOf[c.id] || !neighborsOf(c.id).length) continue;
    const stack = [c.id];
    while (stack.length) {
      const at = stack.pop() as string;
      if (compOf[at]) continue;
      compOf[at] = c.id;
      for (const next of neighborsOf(at)) stack.push(next);
    }
  }
  const groups: Record<string, string[]> = {};
  for (const id in compOf) {
    const rep = compOf[id] as string;
    if (!groups[rep]) groups[rep] = [];
    groups[rep]?.push(id);
  }

  /* 主干择优：比终点、不比长度——长不等于主干，一条反复微调的支线小步多、
   * 能盖过只有几次大转折的正主。判据依次是终点更晚、更长、身份定序；
   * 不设「终点还立着」判据：取代态从链上读，链终点恒无取代出边、恒立在，永不触发。 */
  const better = (a: string[], b: string[]): number => {
    const ea = a[a.length - 1] as string;
    const eb = b[b.length - 1] as string;
    return (
      (byId[eb] as Card).bornAt.localeCompare((byId[ea] as Card).bornAt) ||
      b.length - a.length ||
      (a[0] as string).localeCompare(b[0] as string)
    );
  };

  const trees: Tree[] = Object.values(groups).map((ids) => {
    /* 主干在取代子图上选；整棵树纯靠转向粘起来时退到转向链、同一把尺子 */
    const useSupersede = ids.some((id) => (supOut[id] as string[]).length > 0);
    const outgoing = useSupersede ? supOut : pivOut;
    const incoming = useSupersede ? supIn : pivIn;
    const roots = ids.filter((id) => !(incoming[id] as string[]).length && (outgoing[id] as string[]).length);
    const memo: Record<string, string[]> = {};
    const best = (id: string): string[] => {
      if (!memo[id]) {
        const next = outgoing[id] as string[];
        memo[id] = next.length ? [id, ...(next.map((to) => best(to)).sort(better)[0] as string[])] : [id];
      }
      return memo[id] as string[];
    };
    const spine = roots.map((r) => best(r)).sort(better)[0] as string[];
    const offSpine = ids.filter((id) => !spine.includes(id));
    const sublines: string[][] = [];
    for (const start of offSpine) {
      if (sublines.flat().includes(start)) continue;
      const subline: string[] = [];
      const stack = [start];
      while (stack.length) {
        const id = stack.pop() as string;
        if (subline.includes(id) || spine.includes(id)) continue;
        subline.push(id);
        for (const neighbor of neighborsOf(id)) if (offSpine.includes(neighbor)) stack.push(neighbor);
      }
      sublines.push(
        subline.sort((a, b) => (byId[a] as Card).bornAt.localeCompare((byId[b] as Card).bornAt)),
      );
    }
    return {
      ids,
      spine,
      sublines,
      birth: ids.map((i) => (byId[i] as Card).bornAt).sort()[0] as string,
    };
  });
  trees.sort((a, b) => a.birth.localeCompare(b.birth));

  /* 孤星：两种关系一条都没结的卡（角度烘焙归布局层） */
  const isolated = cards.filter((c) => !compOf[c.id]);
  return { trees, isolated, compOf };
}

/* ================= 建盘 ================= */

/** 建盘的全模型：认根、收卡、求解关系边、按首次出现定领域序、提树。
 * 根卡恰好一张才认主，不是恰好一张时 root 为 null（问题由 scanCards 报进 sick）。
 * day0 含根卡诞生时刻——盘从项目诞生那天起算。 */
export function buildModel(all: readonly RawCard[]): TrajectoryModel {
  const roots = all.filter((c) => c.type === "root");
  const rootRaw = roots.length === 1 ? (roots[0] as RawCard) : null;
  const root: ProjectRoot | null = rootRaw
    ? {
        id: rootRaw.id,
        title: rootRaw.title,
        label: rootRaw.label,
        bornAt: rootRaw.bornAt,
        path: rootRaw.path,
      }
    : null;
  const cards = collectCards(all);
  const byId: Record<string, Card> = {};
  for (const c of cards) byId[c.id] = c;

  const { edges, broken } = collectEdges(all, cards, byId);
  const supersededIds = new Set(edges.filter((e) => e.kind === "supersede").map((e) => e.from));

  /* 领域序 = 按卡的 born-at 序首次出现累积去重。盘上扇区分配靠这个顺序，
   * 换成按卡数或按字母，盘画得不一样、还不报错。
   * 未分道哨兵不进首次出现序，有未分道卡就压尾——隐式组排各泳道之后。 */
  const domains: string[] = [];
  let hasNoDomain = false;
  for (const c of cards) {
    if (c.domain === NO_DOMAIN) {
      hasNoDomain = true;
      continue;
    }
    if (!domains.includes(c.domain)) domains.push(c.domain);
  }
  if (hasNoDomain) domains.push(NO_DOMAIN);

  const { trees, isolated, compOf } = extractTrees(cards, edges, byId);
  const days = cards.map((c) => dayNum(c.bornAt));
  /* 根卡诞生时刻参与定盘界：盘从项目诞生那天起算 */
  if (root && bornAtOk(root.bornAt)) days.push(dayNum(root.bornAt));
  /* 一张卡都没有、也没有可用的根卡诞生时刻：盘界落在今天 */
  const today = dayNum(new Date().toISOString());
  const day0 = days.length ? Math.min(...days) : today;
  const dayMax = days.length ? Math.max(...days) : today;

  return {
    root,
    cards,
    edges,
    broken,
    supersededIds,
    domains,
    byId,
    trees,
    isolated,
    compOf,
    day0,
    dayMax,
  };
}

/** 盘时间范围外的里程碑不画。 */
export function inRange(
  milestones: readonly { date: string; name: string; desc: string }[],
  day0: number,
  dayMax: number,
): Array<{ date: string; name: string; desc: string }> {
  return milestones.filter((milestone) => {
    const d = dayNum(milestone.date);
    return d >= day0 && d <= dayMax;
  });
}
