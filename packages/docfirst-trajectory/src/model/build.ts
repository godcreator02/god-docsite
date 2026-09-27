/**
 * 建模：下游送进来的一张盘（盘心加一组卡）→ 布局要的模型。求关系边、提树、挑主干、定领域序与时间范围。
 * 输入不合格直接抛错：下游只把画得出来的卡送进来，走到这里说明下游有 bug。
 * 纯函数，一句 import 外部模块都没有。
 * 逻辑出自老仓 `god-flow-panels` 的 `node/star/model.ts`（只读参考，本仓不 import 它）。
 */

import type { BrokenRel, Card, DiskCard, DiskInput, Edge, Milestone, TrajectoryModel, Tree } from "./types.ts";

/** 「未分道」隐式组的哨兵值：无 domain 的卡归进这组——着中性色（盘心色一档）、
 * 排各泳道组之后、不占领域色板。拿字符串当 domain 用是为了装箱 / 筛选 / 图例
 * 一条链路不加特例；规范层面不会起这个领域名。 */
export const NO_DOMAIN = "未分道";

/** 时刻的合法形状：分钟级 YYYY-MM-DDTHH:mm 或日级 YYYY-MM-DD。 */
const BORN_AT_RE = /^\d{4}-\d{2}-\d{2}(?:T\d{2}:\d{2})?$/;

/** 日期字符串转天序数——取日期部分强制 UTC 解析，序数是精确整数、零时区依赖。
 * 日级与分钟级两种长度都只吃前 10 位，天然兼容。 */
export function dayNum(d: string): number {
  return Date.parse(`${d.slice(0, 10)}T00:00:00Z`) / 86400000;
}

/** 天序数转 MM-DD 显示。 */
export function formatDay(n: number): string {
  return new Date(n * 86400000).toISOString().slice(5, 10);
}

/** 时刻写得合不合格：形状对、日期真能解析。下游校验卡的时刻用同一个判据。 */
export function validBornAt(v: string): boolean {
  return BORN_AT_RE.test(v) && !Number.isNaN(dayNum(v));
}

/** 卡的盘上形态：有取代出边（被别的卡取代）即「被取代」，否则「在立」。 */
export function formOf(
  model: Pick<TrajectoryModel, "supersededIds">,
  id: string,
): "alive" | "superseded" {
  return model.supersededIds.has(id) ? "superseded" : "alive";
}

/** 结论卡集：每棵树主干末端那张（`tree.spine` 最后一张）——尺寸放大档与跨日错开都按它判，在立与否另判。 */
export function spineTipIds(trees: Tree[]): Set<string> {
  const out = new Set<string>();
  for (const t of trees) {
    const tip = t.spine.at(-1);
    if (tip) out.add(tip);
  }
  return out;
}

/* ================= 输入校验 ================= */

/** 输入里不合格的地方一次列全再抛：身份重复、时刻写坏、关系种类不认识。 */
function assertInput(input: DiskInput): void {
  const errors: string[] = [];
  const seen = new Set<string>();
  const claim = (id: string): void => {
    if (seen.has(id)) errors.push(`身份「${id}」重复`);
    seen.add(id);
  };
  if (input.center) {
    claim(input.center.id);
    if (input.center.bornAt !== null && !validBornAt(input.center.bornAt)) {
      errors.push(`盘心「${input.center.id}」的 bornAt「${input.center.bornAt}」不是 YYYY-MM-DD 或 YYYY-MM-DDTHH:mm`);
    }
  }
  for (const card of input.cards) {
    claim(card.id);
    if (!validBornAt(card.bornAt)) {
      errors.push(`卡「${card.id}」的 bornAt「${card.bornAt}」不是 YYYY-MM-DD 或 YYYY-MM-DDTHH:mm`);
    }
    for (const rel of card.relations) {
      if (rel.kind !== "supersede" && rel.kind !== "pivot") {
        errors.push(`卡「${card.id}」的关系种类「${String(rel.kind)}」不认识，只有 supersede 与 pivot`);
      }
    }
  }
  if (errors.length > 0) throw new Error(`星轨盘的输入不合格：\n${errors.join("\n")}`);
}

/* ================= 上盘 ================= */

function toCard(input: DiskCard): Card {
  return {
    id: input.id,
    domain: input.domain?.trim() || NO_DOMAIN,
    bornAt: input.bornAt,
    label: input.label,
    kind: input.kind,
  };
}

/** 上盘卡按时刻排：字典序即时间序（同刻日级排在分钟级前），并列按身份收尾。 */
function collectCards(inputs: readonly DiskCard[]): Card[] {
  return inputs
    .map(toCard)
    .sort((a, b) => a.bornAt.localeCompare(b.bornAt) || a.id.localeCompare(b.id));
}

/* ================= 关系边与树 ================= */

/** 求解关系边：目标在盘上卡集合里的成边，不在的收进坏关系。 */
function collectEdges(
  inputs: readonly DiskCard[],
  cards: readonly Card[],
  byId: Record<string, Card>,
): { edges: Edge[]; broken: BrokenRel[] } {
  const relationsOf = new Map(inputs.map((c) => [c.id, c.relations]));
  const edges: Edge[] = [];
  const broken: BrokenRel[] = [];
  for (const c of cards) {
    for (const rel of relationsOf.get(c.id) as DiskCard["relations"]) {
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

/** 盘时间范围外的里程碑不画。 */
function inRange(milestones: readonly Milestone[], day0: number, dayMax: number): Milestone[] {
  return milestones.filter((milestone) => {
    const d = dayNum(milestone.date);
    return d >= day0 && d <= dayMax;
  });
}

/** 建一张盘：校验输入、收卡、求解关系边、按首次出现定领域序、提树、定时间范围。
 * day0 含盘心诞生时刻——盘从项目诞生那天起算。 */
export function buildModel(input: DiskInput): TrajectoryModel {
  assertInput(input);
  const center = input.center;
  const cards = collectCards(input.cards);
  const byId: Record<string, Card> = {};
  for (const c of cards) byId[c.id] = c;

  const { edges, broken } = collectEdges(input.cards, cards, byId);
  const supersededIds = new Set(edges.filter((e) => e.kind === "supersede").map((e) => e.from));

  /* 领域序 = 按卡的 bornAt 序首次出现累积去重。盘上扇区分配靠这个顺序，
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
  /* 盘心诞生时刻参与定盘界：盘从项目诞生那天起算 */
  if (center?.bornAt) days.push(dayNum(center.bornAt));
  /* 一张卡都没有、也没有盘心诞生时刻：盘界落在今天 */
  const today = dayNum(new Date().toISOString());
  const day0 = days.length ? Math.min(...days) : today;
  const dayMax = days.length ? Math.max(...days) : today;

  return {
    center,
    milestones: center ? inRange(center.milestones, day0, dayMax) : [],
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
