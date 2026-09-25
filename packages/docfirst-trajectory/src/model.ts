/**
 * 由卡目录建模：认根靠 `type: root`；项目 id 铁律 = 文件名主干，不再靠字段自指互证；
 * 聚盘与上盘按 `parent`（归盘即上盘，`domain` 只是泳道分组、不是上盘门票）；
 * 子项目根卡（有 parent 的根卡）默认在所属项目盘上投影为虫洞；`merged-in` 列出的父盘上
 * 不画虫洞，改为子项目整盘内容（递归）摊入——带环保护；
 * 时间轴吃 `born-at`（分钟级 `YYYY-MM-DDTHH:mm`，日级 `YYYY-MM-DD` 兼容）；
 * 关系边是正文 inline field（`supersedes::` / `pivots-from::`，链接目标即卡身份，
 * md link 与 wikilink 两形态都认）；
 * 根卡不上自己的盘（盘心圆盘即根卡），诞生时刻只参与定盘界；里程碑从根卡正文「## 里程碑」解析。
 *
 * 纯函数，不碰文件系统——读卡目录在 `@godcreator/docfirst-workflow` 的 `scanCardDir`，
 * 这个包一句 import 外部模块都没有。扫盘一趟读完、内存聚盘：
 * `scanCards` 出 `RawCard[]`，本文件的建模函数一概只吃它——同一份卡集合能反复喂给不同
 * rootId 各自建模，不重复读盘。报病按文件归拢成 `SickFile`。
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
import type {
  Card,
  DiskInfo,
  DayRange,
  Edge,
  BrokenRel,
  Problem,
  ProjectRoot,
  RawCard,
  SickFile,
  TrajectoryModel,
  Tree,
  Wormhole,
} from "./types.ts";

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

/** 卡身份的形状：文件名主干，不带扩展名（`.md` / `.mdx` 都不带）、不带路径分隔。 */
function idShapeOk(v: string): boolean {
  return v !== "" && !v.includes("/") && !v.includes("\\") && !/\.mdx?$/.test(v);
}

/* ================= 扫盘：一趟读完，后续全在内存上算 ================= */

/** 一个文件解析出的卡与它自己的病。不是卡（六个字段一个都不沾）时 card 为 null。 */
export interface ParsedFile {
  card: RawCard | null;
  problems: Problem[];
}

/** 把一份卡文件的全文变成 RawCard，顺带跑三层校验（形状 / 存在性 / 一致性）。
 * 「卡正文里不许钉码」是钉码那一侧的规矩，由 `@godcreator/docfirst-workflow` 读卡目录时另加。
 * 六个卡体系字段一个都不沾的文件不是卡：card 与 problems 都回空，整文件跳过。 */
export function parseCardFile(id: string, path: string, mtime: number, text: string): ParsedFile {
  const fm: Frontmatter | null = parseFrontmatter(text);
  if (!fm || !CARD_KEYS.some((k) => fm[k] !== undefined)) return { card: null, problems: [] };

  const title = titleOf(id);
  const bornAt = scalarOf(fm, "born-at") ?? "";
  const type = scalarOf(fm, "type");
  const parent = listOf(fm, "parent");
  const mergedIn = listOf(fm, "merged-in");
  const domain = scalarOf(fm, "domain");
  const rawLabel = scalarOf(fm, "label");
  const isRoot = type === "root";

  const problems: Problem[] = [];
  const bad = (field: Problem["field"], value: string, reason: string): void => {
    problems.push({ field, value, reason });
  };

  /* 存在性校验：born-at / label 全卡必填；parent 内卡必填，根卡可缺 */
  if (!bornAt) bad("born-at", "", "缺 born-at（全卡必填）");
  else if (!bornAtOk(bornAt)) {
    bad("born-at", bornAt, "born-at 格式须 YYYY-MM-DD 或 YYYY-MM-DDTHH:mm");
  }
  if (!isRoot && !parent.length) bad("parent", "", "缺 parent（内卡必填；根卡可缺）");
  if (rawLabel === null || rawLabel.trim() === "") {
    bad("label", rawLabel ?? "", "缺 label（全卡必填）");
  }
  /* 形状校验：parent / merged-in 元素都得是卡身份（文件名主干） */
  for (const v of parent) {
    if (!idShapeOk(v)) bad("parent", v, "parent 元素须为卡身份（文件名主干，不带 .md / .mdx 与路径）");
  }
  for (const v of mergedIn) {
    if (!idShapeOk(v)) {
      bad("merged-in", v, "merged-in 元素须为卡身份（文件名主干，不带 .md / .mdx 与路径）");
    }
  }
  /* 一致性校验：①parent 不含自身 ②merged-in ⊆ parent（出界项逐个报） ③内卡禁写 merged-in */
  if (parent.includes(id)) bad("parent", id, "parent 不得包含自身");
  for (const v of mergedIn) {
    if (!parent.includes(v)) bad("merged-in", v, "merged-in 元素须 ⊆ parent");
  }
  if (!isRoot && mergedIn.length) bad("merged-in", mergedIn.join(","), "merged-in 仅根卡可写");

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
      mergedIn,
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

/* ================= 聚盘 ================= */

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

/** 单张盘的收卡实作，供 collectCards 递归摊入复用：diskId 是当前正被展开的盘——
 * 顶层调用即 rootId 本身，平铺投影递归时改传子项目身份，out / wormholes 两个输出数组
 * 全程共享（子项目盘的内卡与它自己的虫洞都摊平进同一份清单）。
 * visited 是环保护：一个项目盘整次收卡只展开一次，重逢（含环路绕回自身）直接跳过。 */
function gatherDisk(
  all: readonly RawCard[],
  diskId: string,
  visited: Set<string>,
  out: Card[],
  wormholes: Wormhole[],
): void {
  for (const c of all) {
    if (c.type === "root") {
      /* 自己的盘盘心即根卡，不出节点；born-at 病的根卡不上盘（与内卡同口径） */
      if (c.id === diskId) continue;
      if (!c.parent.includes(diskId) || !bornAtOk(c.bornAt)) continue;
      if (c.mergedIn.includes(diskId)) {
        /* 平铺投影：已展开过的盘（环路）直接跳过，不重复摊入、不再递归 */
        if (visited.has(c.id)) continue;
        visited.add(c.id);
        /* 子项目根卡自己画普通节点：domain / label 待遇与内卡一致 */
        out.push(toCard(c));
        /* 子项目盘的整套内容（内卡 + 它自己的虫洞 / 平铺子项目）递归摊入本盘 */
        gatherDisk(all, c.id, visited, out, wormholes);
      } else {
        /* 虫洞：通往子项目盘的入口，不展开内容 */
        wormholes.push({ id: c.id, title: c.title, label: c.label, bornAt: c.bornAt, path: c.path });
      }
      continue;
    }
    if (!c.parent.includes(diskId)) continue;
    /* born-at 坏的上不了盘（半径标度一路 NaN）——病已进 sick，这里只挡不收；
     * 其余字段病不挡渲染，示众归报病列表 */
    if (!bornAtOk(c.bornAt)) continue;
    out.push(toCard(c));
  }
}

/** 收一张盘的上盘卡与虫洞：parent 含该盘即上盘——定案规则。 */
function collectCards(
  all: readonly RawCard[],
  diskId: string,
): { cards: Card[]; wormholes: Wormhole[] } {
  const out: Card[] = [];
  const wormholes: Wormhole[] = [];
  gatherDisk(all, diskId, new Set([diskId]), out, wormholes);
  /* 字典序即时间序（同刻日级排在分钟级前），并列按身份收尾 */
  out.sort((a, b) => a.bornAt.localeCompare(b.bornAt) || a.id.localeCompare(b.id));
  wormholes.sort((a, b) => a.bornAt.localeCompare(b.bornAt) || a.id.localeCompare(b.id));
  return { cards: out, wormholes };
}

/** 盘清单：每张根卡一张盘，带它的成员卡身份列表。
 * 序按「最近有活动」降序——最近动过的盘排前。 */
export function buildDisks(all: readonly RawCard[]): DiskInfo[] {
  const roots = all.filter((c) => c.type === "root");
  const disks = roots.map((r) => {
    const { cards } = collectCards(all, r.id);
    const latest = cards.reduce((acc, c) => (c.bornAt > acc ? c.bornAt : acc), r.bornAt);
    return { rootId: r.id, memberIds: cards.map((c) => c.id), latest };
  });
  disks.sort((a, b) => b.latest.localeCompare(a.latest) || a.rootId.localeCompare(b.rootId));
  return disks.map(({ rootId, memberIds }) => ({ rootId, memberIds }));
}

/* ================= 关系边与树 ================= */

/** 按盘求解正文关系边：目标在本盘卡集合里的成边，不在的收进坏关系示众。 */
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

/** 建一张盘的全模型：收卡、按盘求解关系边、按首次出现定领域序、提树。
 * day0 含根卡诞生时刻——盘从项目诞生那天起算。
 * range（日期窗，天序数闭区间）非空时走裁剪：先全量收卡收边再裁——越界端点是
 * 「不在窗内」不是「指向不存在」，不能混进 broken 冤枉好卡；
 * 边只留两端都在窗内，树 / 领域序按窗内子集重提，supersededIds 保留全量判定；
 * 盘界钉下不钉上：下界钉在窗口起点（不早于项目诞生），上界取窗内最晚活动。 */
export function buildModel(
  all: readonly RawCard[],
  rootId: string,
  range?: DayRange,
): TrajectoryModel {
  const rootRaw = all.find((c) => c.id === rootId && c.type === "root") ?? null;
  const root: ProjectRoot | null = rootRaw
    ? {
        id: rootRaw.id,
        title: rootRaw.title,
        label: rootRaw.label,
        bornAt: rootRaw.bornAt,
        path: rootRaw.path,
      }
    : null;
  const collected = collectCards(all, rootId);
  const byIdAll: Record<string, Card> = {};
  const dupes: string[] = [];
  for (const c of collected.cards) {
    if (byIdAll[c.id]) dupes.push(c.id);
    else byIdAll[c.id] = c;
  }

  const allEdges = collectEdges(all, collected.cards, byIdAll);
  const supersededIds = new Set(
    allEdges.edges.filter((e) => e.kind === "supersede").map((e) => e.from),
  );

  /* 裁剪：范围外的卡与虫洞不上盘；无窗时原样透传，零开销 */
  const inWindow = (bornAt: string): boolean => {
    if (!range) return true;
    const d = dayNum(bornAt);
    return d >= range.d0 && d <= range.d1;
  };
  const cards = range ? collected.cards.filter((c) => inWindow(c.bornAt)) : collected.cards;
  const wormholes = range
    ? collected.wormholes.filter((w) => inWindow(w.bornAt))
    : collected.wormholes;
  const byId: Record<string, Card> = {};
  for (const c of cards) byId[c.id] = c;
  const edges = range ? allEdges.edges.filter((e) => byId[e.from] && byId[e.to]) : allEdges.edges;

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
  /* 虫洞有自己的时间位置：born-at 参与定盘界（落时间轴原位） */
  for (const w of wormholes) days.push(dayNum(w.bornAt));
  /* 根卡诞生时刻参与定盘界：盘从项目诞生那天起算 */
  const rootDay = root && bornAtOk(root.bornAt) ? dayNum(root.bornAt) : null;
  const today = dayNum(new Date().toISOString());

  let day0: number;
  let dayMax: number;
  if (range) {
    /* 钉下不钉上；窗内一张卡都没有 → 空盘（day0 = dayMax = 窗口下界） */
    const lo = Math.max(range.d0, rootDay ?? range.d0);
    day0 = days.length ? Math.min(lo, Math.min(...days)) : lo;
    dayMax = days.length ? Math.max(...days) : day0;
  } else {
    if (rootDay !== null) days.push(rootDay);
    day0 = days.length ? Math.min(...days) : today;
    dayMax = days.length ? Math.max(...days) : today;
  }

  return {
    root,
    cards,
    wormholes,
    edges,
    broken: allEdges.broken,
    dupes,
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
