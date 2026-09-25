/**
 * 编排服务。三个动作：
 *   resolve(doc, text)                核对：调格式认引用，出清单，不写任何东西
 *   resolveRefs(doc, refs)            同上，但引用已经有人认好了（有语法树的宿主用，跳过 parse）
 *   confirm(doc, text, { accept })    确认：按清单逐处决定写不写回、写回成什么，交格式改文档
 *
 * 每处引用的记录就在它自己的记号上，写回互不牵连：一处钉不住只是那一处不动，别的照写。
 * 判定层不碰磁盘：每种目标要看的东西（观察）由读取器给，旧内容与 hunk 表由 History 给。
 */

import { judge, snapshot } from "./compare.ts";
import { sliceSpan } from "./span.ts";
import { fileOf } from "./types.ts";
import type { Format, History, Item, Listing, Reader, Reference, Span, Target } from "./types.ts";

/**
 * 确认时对一处引用做了什么：
 *   recorded       未确认的（草稿、没写记录的正式记号）记上今天的记录
 *   moved          绿的行段挪了位置，写回新行号与新记录
 *   accepted       带 --accept 时，黄的按今天的内容重新记
 *   unchanged      绿的、原地没动，不写
 *   needs-accept   黄的、没带 --accept，不写，等人复核
 *   refused        红的或钉不住的，不写
 */
export type ConfirmAction = "recorded" | "moved" | "accepted" | "unchanged" | "needs-accept" | "refused";

export interface ConfirmStep {
  item: Item;
  action: ConfirmAction;
  /** recorded / moved / accepted：写回之后的引用 */
  written?: Reference;
  /** refused 且不是因为红（钉不住）时的原因；红的原因看 item.reason */
  problem?: string;
}

export interface ConfirmResult {
  listing: Listing;
  text: string;
  changed: boolean;
  /** 跟 listing.items 一一对应、同序 */
  steps: ConfirmStep[];
}

export interface ConfirmOptions {
  /** 黄灯按今天的内容重新记 */
  accept: boolean;
}

export interface Service {
  formatFor(doc: string): Format | null;
  resolve(doc: string, text: string): Listing;
  resolveRefs(doc: string, references: Reference[]): Listing;
  confirm(doc: string, text: string, options: ConfirmOptions): ConfirmResult;
}

export interface ServiceDeps {
  formats: Format[];
  reader: Reader;
  history: History;
}

/** 目标的观察：行段 / 整文件 / 名字看文件的行，目录树看名字表，存在性看类型 */
function observe(reader: Reader, target: Target): string[] | null {
  if (target.kind === "tree") return reader.list?.(target.dir, target.depth, target.glob) ?? null;
  if (target.kind === "exists") {
    const type = reader.kindOf?.(target.path) ?? null;
    return type === null ? null : [type];
  }
  return reader.read(fileOf(target)!);
}

/** 观察的键：同一次核对里同一样东西只看一遍 */
function observeKey(target: Target): string {
  if (target.kind === "tree") return `tree ${target.dir} ${target.depth} ${target.glob ?? ""}`;
  if (target.kind === "exists") return `exists ${target.path}`;
  return `file ${fileOf(target)}`;
}

/**
 * 这一处「当前是什么」：行段 / 整文件切那几行，目录树是名字表，名字没有展示内容；
 * 存在性没有内容可言（absent 断言成立时观察本来就是空的），一律给空表，在不在由判定说
 */
function currentOf(target: Target, text: string[] | null, lines: Span): string[] | null {
  if (target.kind === "span" || target.kind === "file") return sliceSpan(text, lines);
  if (target.kind === "has") return text === null ? null : [];
  if (target.kind === "exists") return [];
  return text;
}

const sameSpan = (a: Span, b: Span): boolean => a[0] === b[0] && a[1] === b[1];

export function createService({ formats, reader, history }: ServiceDeps): Service {
  /** 一篇文档只能有一个格式认领；两个都认领是配置错误，报出来而不是靠顺序静默定胜负 */
  function formatFor(doc: string): Format | null {
    const hits = formats.filter((f) => f.claims(doc));
    if (hits.length > 1) {
      throw new Error(`${doc}：${hits.map((f) => f.name).join("、")} 都认领了这篇——一篇文档只能有一个格式`);
    }
    return hits[0] ?? null;
  }

  function needFormat(doc: string): Format {
    const format = formatFor(doc);
    if (format === null) throw new Error(`${doc}：没有格式认领这篇文档`);
    return format;
  }

  function observerCache(): (target: Target) => string[] | null {
    const cache = new Map<string, string[] | null>();
    return (target) => {
      const key = observeKey(target);
      if (!cache.has(key)) cache.set(key, observe(reader, target));
      return cache.get(key) ?? null;
    };
  }

  function itemOf(doc: string, reference: Reference, look: (target: Target) => string[] | null): Item {
    const text = look(reference.target);
    const judged = judge(reference.target, reference.record, text, history);
    const current = judged.status === "missing" ? null : currentOf(reference.target, text, judged.lines);
    const item: Item = { doc, reference, current, status: judged.status, lines: judged.lines };
    if (judged.reason !== undefined) item.reason = judged.reason;
    if (judged.diff !== undefined) item.diff = judged.diff;
    if (judged.old !== undefined) item.old = judged.old;
    // 判定说「有内容」但这会儿切不出来（行段跟到文件外）：宁可报缺失，别拿空段冒充新鲜
    if (item.current === null && item.status !== "missing") {
      item.status = "missing";
      item.reason = "vanished";
    }
    return item;
  }

  function resolveRefs(doc: string, references: Reference[], look = observerCache()): Listing {
    return { doc, items: references.map((reference) => itemOf(doc, reference, look)) };
  }

  function resolve(doc: string, text: string): Listing {
    return resolveRefs(doc, needFormat(doc).parse(text));
  }

  /** 按今天的样子重新记一处：行段钉到判定跟到的位置 */
  function rerecord(item: Item, look: (target: Target) => string[] | null): { written: Reference } | { problem: string } {
    const was = item.reference.target;
    const target: Target = was.kind === "span" ? { kind: "span", file: was.file, a: item.lines[0], b: item.lines[1] } : was;
    const taken = snapshot(target, look(target));
    if ("problem" in taken) return taken;
    return { written: { ...item.reference, target, record: taken.record } };
  }

  function stepOf(item: Item, accept: boolean, look: (target: Target) => string[] | null): ConfirmStep {
    const target = item.reference.target;
    const redo = (action: ConfirmAction): ConfirmStep => {
      const done = rerecord(item, look);
      return "problem" in done ? { item, action: "refused", problem: done.problem } : { item, action, written: done.written };
    };
    switch (item.status) {
      case "missing":
        return { item, action: "refused" };
      case "unconfirmed":
        return redo("recorded");
      case "changed":
        return accept ? redo("accepted") : { item, action: "needs-accept" };
      case "fresh":
        return target.kind === "span" && !sameSpan([target.a, target.b], item.lines) ? redo("moved") : { item, action: "unchanged" };
    }
  }

  function confirm(doc: string, text: string, { accept }: ConfirmOptions): ConfirmResult {
    const format = needFormat(doc);
    const look = observerCache();
    const listing = resolveRefs(doc, format.parse(text), look);
    const steps = listing.items.map((item) => stepOf(item, accept, look));
    const written = steps.flatMap((step) => (step.written !== undefined ? [step.written] : []));
    const next = written.length > 0 ? format.write(text, written) : text;
    return { listing, text: next, changed: next !== text, steps };
  }

  return { formatFor, resolve, resolveRefs: (doc, references) => resolveRefs(doc, references), confirm };
}
