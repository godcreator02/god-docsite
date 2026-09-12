/**
 * 摆放：mdx 正本 → 落点上的生成物。
 *
 * 一篇文档在 `docfirst.config` 的 `outputs` 里挂了几个落点，摆放就把它渲成一份干净 md、
 * 戴上点名的 frontmatter 字段、写到每个落点上；核对是同一份正文跟落点上那份逐字节比。
 * 配置归一、地盘规则、渲染、整形、frontmatter 挑行、四态判定，全在这一份里。
 *
 * 生成物怎么落地不在这一份里：读一个落点、写一个落点由 `PlacingHost` 给（真盘一份、内存一份），
 * 所以这个文件一句 `node:fs` 都不 import。
 *
 * 对外只有两个方法：`render` 摆一趟、回落点清单，`check` 只核对、回每个落点的四态。
 * 摆出去的和守着的是**同一段正文**——两条路走的是同一个 `bodyOf`，所以摆完必然是新鲜的。
 */
import { isAbsolute, join, relative, resolve, sep } from "node:path";
import type { Format, Service } from "../engine/index.ts";
import type { ProjectConfig } from "./load.ts";

/** outputs 里的一个目标，对象写法：`to` 相对项目根；`frontmatter` 点名哪些字段随行到生成物头部 */
export interface OutputTarget {
  to: string;
  /** mdx 源 frontmatter 里要原样带到生成物头部的字段名（如 SKILL.md 要的 name / description）；不给就整段剥掉 */
  frontmatter?: string[];
}

/** 摆放目标归一化之后的样子：字符串写法等于 `frontmatter: []` */
export interface Placement {
  to: string;
  frontmatter: string[];
}

/** 一个落点的四态：fresh 生成物跟源一致；missing 生成物还不在；stale 跟源不一致；no-frontmatter 源头部缺点名的字段 */
export type PlacedStatus = "fresh" | "missing" | "stale" | "no-frontmatter";

/** 一个落点核对完的样子 */
export interface PlacedCheck {
  to: string;
  status: PlacedStatus;
  /** 判定结果：四态里只有 fresh 算新鲜。读报告的人照它决定要不要重摆，不必再把四态解释一遍 */
  fresh: boolean;
  /** no-frontmatter 时缺哪几个字段 */
  missing?: string[];
}

/** 摆一个落点的结果：placed 摆过去了；no-frontmatter 源头部缺 `missing` 里那几个字段，这个落点没摆 */
export interface PlacedWrite {
  to: string;
  status: "placed" | "no-frontmatter";
  missing?: string[];
}

/** 摆放这件事的全部对外面貌 */
export interface Placing {
  /**
   * 这一篇摆一趟：渲一份正文，戴上点名的 frontmatter 字段，写到每个落点，回落点清单。
   * 缺字段的落点不写（摆一份缺 name 的 SKILL.md 比不摆更糟）。
   * 没挂落点、格式不出 ai 产物，回空清单——那是「这篇没有摆放这回事」，不是错。
   */
  render(doc: string): Promise<PlacedWrite[]>;
  /** 这一篇的落点核对一趟，只读不写：回每个落点的四态与缺哪些 frontmatter 字段 */
  check(doc: string): Promise<PlacedCheck[]>;
}

/**
 * 摆放认得的外面那一圈。前半是项目面（根、配置、判定服务、组件名册、这篇挂了哪些落点、这篇的原文），
 * 装配时把装好的项目递进来；后半是**生成物的存放**——摆放不知道落点是文件还是别的什么，
 * 生产给的是真盘那份，测试给的是内存那份。
 */
export interface PlacingHost {
  root: string;
  config: ProjectConfig;
  service: Service;
  roster: Record<string, unknown> | undefined;
  placements(doc: string): Placement[];
  /** mdx 正本的原文 */
  read(doc: string): string;
  /** 一个落点上现在摆着什么；还没摆过给 null。`to` 是配置里写的那个落点，怎么落地由实现说了算 */
  readPlaced(to: string): string | null;
  /** 把生成物摆到一个落点上；落点的容器（真盘那份就是父目录）不在得自己备好 */
  writePlaced(to: string, text: string): void;
}

/** fumadocs 给站上 .md 路由的标题加的锚记（`# 标题 [#锚]`），摆放产物不要 */
const ANCHOR = /^(#{1,6} .+) \[#[^\]]*\]$/gm;
/** 序列化器紧跟标点后保守转义的加粗星号（`&#x2A;*` 是逃逸了一半的 `**`），摆放产物还原成可读的加粗 */
const STAR = /&#x2A;\*/g;
/** frontmatter 里一条顶层键的行头：列 0 起、`键:` */
const TOP_KEY = /^([\w-]+):/;
/** 产物开头整段 frontmatter：fumadocs 的 _markdown 已经没有它，别的格式的 ai 产物可能还带着——摆放产物一律不带 */
const LEADING_FRONTMATTER = /^﻿?---\r?\n[\s\S]*?\r?\n---[ \t]*\r?\n?/;

/**
 * `outputs` 的两种目标写法归成一张表：字符串等于 `{ to, frontmatter: [] }`。
 * 形状不对当场拒——摆错地方比不摆更糟。
 */
export function placementsOf(config: Pick<ProjectConfig, "outputs">): Record<string, Placement[]> {
  const table: Record<string, Placement[]> = {};
  for (const [doc, targets] of Object.entries(config.outputs ?? {})) {
    if (!Array.isArray(targets) || targets.length === 0) throw new Error(`outputs 的 ${doc}：目标得是非空数组`);
    table[doc] = targets.map((raw) => {
      const target: OutputTarget = typeof raw === "string" ? { to: raw } : raw;
      if (typeof target !== "object" || target === null || typeof target.to !== "string" || target.to === "") {
        throw new Error(`outputs 的 ${doc}：每个目标得是非空的相对路径，或 { to, frontmatter? }`);
      }
      const frontmatter = target.frontmatter ?? [];
      if (!Array.isArray(frontmatter) || frontmatter.some((field) => typeof field !== "string" || field.trim() === "")) {
        throw new Error(`outputs 的 ${doc} → ${target.to}：frontmatter 得是字段名数组`);
      }
      return { to: target.to, frontmatter };
    });
  }
  return table;
}

/** 地盘规则：目标相对项目根、不落进任何一个文档目录（那是源的地盘）、一个目标只许一个文档写 */
export function assertTurf(root: string, docsDirs: string[], table: Record<string, Placement[]>): void {
  const claimed = new Map<string, string>();
  for (const [doc, targets] of Object.entries(table)) {
    for (const { to } of targets) {
      if (isAbsolute(to)) throw new Error(`outputs 的 ${doc} → ${to}：目标得相对项目根，绝对路径不认`);
      const rel = relative(root, resolve(root, to));
      for (const dir of docsDirs) {
        const relDocs = relative(root, join(root, dir));
        if (rel === relDocs || rel.startsWith(relDocs + sep)) {
          throw new Error(`outputs 的 ${doc} → ${to}：目标落进了文档目录，那是源文件的地盘`);
        }
      }
      const owner = claimed.get(to);
      if (owner !== undefined) throw new Error(`outputs 的 ${owner} 和 ${doc} 都往 ${to} 摆——一个目标只许一个文档写`);
      claimed.set(to, doc);
    }
  }
}

/** 格式的 ai 产物 → 摆放产物的正文（还没戴 frontmatter）：剥站上的锚记、还原加粗、去掉开头空行 */
function tidy(rendered: string): string {
  return rendered.replace(LEADING_FRONTMATTER, "").replace(ANCHOR, "$1").replace(STAR, "**").replace(/^\n+/, "");
}

/** 挑出来的 frontmatter：点名的字段按源里的顺序原样成行；源里没有的字段列在 missing */
interface PickedFrontmatter {
  lines: string[];
  missing: string[];
}

/**
 * 从 mdx / md 源的 frontmatter 里挑点名的字段，**逐行原样**搬出来——一条字段从它的顶层键行起，
 * 到下一条顶层键行止（块式列表、多行标量的缩进续行都跟着走）。不解析 YAML：搬的是作者写下的
 * 那几行，生成物头部长什么样作者一眼对得上。源没有 frontmatter、或字段不在，记进 missing。
 *
 * 形状跟轨迹包 `parse.ts` 的 frontmatter 扫描逐字节相同，两处**有意各留一份**：轨迹包零依赖，
 * 不 import 任何兄弟包；这几行是稳定语法的复刻，不是会一起变的逻辑。
 */
function pickFrontmatter(source: string, fields: string[]): PickedFrontmatter {
  const text = source.replace(/^﻿/, "").replace(/\r\n/g, "\n");
  const blocks = new Map<string, string[]>();
  if (text.startsWith("---\n")) {
    const end = text.indexOf("\n---", 3);
    if (end >= 0) {
      let current: string[] | null = null;
      for (const line of text.slice(4, end).split("\n")) {
        const key = TOP_KEY.exec(line);
        if (key !== null) {
          current = [line];
          blocks.set(key[1]!, current);
        } else if (current !== null && /^[ \t]/.test(line)) {
          current.push(line);
        } else {
          current = null;
        }
      }
    }
  }
  const lines: string[] = [];
  const missing: string[] = [];
  for (const field of fields) {
    const block = blocks.get(field);
    if (block === undefined) missing.push(field);
    else lines.push(...block);
  }
  return { lines, missing };
}

/** 正文戴上 frontmatter：没挑出任何字段就是正文本身（字符串写法的 outputs 走的就是这条） */
function withFrontmatter(body: string, lines: string[]): string {
  if (lines.length === 0) return body;
  return `---\n${lines.join("\n")}\n---\n\n${body}`;
}

export function createPlacing(host: PlacingHost): Placing {
  /** 这一篇有没有摆放这回事：挂了落点、有格式、格式出 ai 产物，三样齐了才算 */
  function placingInputs(doc: string): { targets: Placement[]; text: string; format: Format } | null {
    const targets = host.placements(doc);
    if (targets.length === 0) return null;
    const format = host.service.formatFor(doc);
    if (format === null || typeof format.renderAi !== "function") return null;
    return { targets, text: host.read(doc), format };
  }

  /** 摆放产物的正文：问格式要 ai 产物再整形。同一篇的几个落点共用这一份，frontmatter 各戴各的 */
  async function bodyOf(doc: string, text: string, format: Format): Promise<string> {
    const listing = host.service.resolve(doc, text);
    const rendered = await format.renderAi!(text, listing, {
      root: host.root,
      doc,
      roster: host.roster,
      config: host.config as unknown as Record<string, unknown>,
    });
    return tidy(rendered);
  }

  return {
    async render(doc) {
      const inputs = placingInputs(doc);
      if (inputs === null) return [];
      const body = await bodyOf(doc, inputs.text, inputs.format);
      const out: PlacedWrite[] = [];
      for (const { to, frontmatter } of inputs.targets) {
        const picked = pickFrontmatter(inputs.text, frontmatter);
        if (picked.missing.length > 0) {
          out.push({ to, status: "no-frontmatter", missing: picked.missing });
          continue;
        }
        host.writePlaced(to, withFrontmatter(body, picked.lines));
        out.push({ to, status: "placed" });
      }
      return out;
    },

    async check(doc) {
      const inputs = placingInputs(doc);
      if (inputs === null) return [];
      const body = await bodyOf(doc, inputs.text, inputs.format);
      const out: PlacedCheck[] = [];
      for (const { to, frontmatter } of inputs.targets) {
        const picked = pickFrontmatter(inputs.text, frontmatter);
        if (picked.missing.length > 0) {
          out.push({ to, status: "no-frontmatter", fresh: false, missing: picked.missing });
          continue;
        }
        const placed = host.readPlaced(to);
        if (placed === null) {
          out.push({ to, status: "missing", fresh: false });
          continue;
        }
        // 换行归一在这儿不在宿主里：这是「算不算同一份」的口径，不是存放的事
        const same = placed.replace(/\r\n/g, "\n") === withFrontmatter(body, picked.lines);
        out.push({ to, status: same ? "fresh" : "stale", fresh: same });
      }
      return out;
    },
  };
}
