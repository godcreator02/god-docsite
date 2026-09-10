/**
 * 编排服务。三个动作：
 *   resolve(doc, text)        核对：调格式认引用，出清单，不写任何东西
 *   resolveRefs(doc, refs)    同上，但引用已经有人认好了（有语法树的宿主用，跳过 parse）
 *   confirm(doc, text)        确认：让比较器出记录、刷记录簿、清孤儿、让格式写回
 *   strays / forget(docs)     文档本身删了、挪了，它的记录没人逐篇去看：按文档清单一览、整个忘掉
 *
 * 引用的身份 = 文档 + 引用写的目标；同一篇里指向同一段的两处引用共用一条记录。
 * 记录带 kind，判定层不看它：认不认这条记录是比较器的事（别家的记录交回「未确认」，不猜）——
 * 一个项目里 git 记录和 hash 记录可以并存，按记录的 kind 转发的是 host 那层的 auto 比较器。
 *
 * 判定层不碰磁盘：每种目标要看的东西（观察）由读取器给——行段 / 整文件 / 名字是文件的行，目录树是名字表，
 * 存在性是类型；比较器只吃观察。
 */

import { sliceSpan } from "./span.ts";
import { targetKey } from "./marker.ts";
import { fileOf } from "./types.ts";
import type { Comparator, Fill, Format, Item, Ledger, Listing, MemoRecord, Reader, Reference, Span, Target } from "./types.ts";

export interface ConfirmResult {
  listing: Listing;
  text: string;
  changed: boolean;
  /** 非空 = 一条都没写：整篇拒绝 */
  problems: string[];
  /** 这一趟写进记录簿的记录，跟 listing.items 一一对应、同序；整篇拒时为空。命令行靠它说清楚每处拿到的是哪种记忆 */
  pinned: Array<{ target: Target; record: MemoRecord }>;
}

export interface Service {
  formatFor(doc: string): Format | null;
  resolve(doc: string, text: string): Listing;
  resolveRefs(doc: string, references: Reference[]): Listing;
  confirm(doc: string, text: string): ConfirmResult;
  /** 记录簿里有、文档清单里没有的文档（删了、挪了）——它们的记录没人逐篇去看，这里一览 */
  strays(docs: string[]): string[];
  /** 把 strays 的记录整个忘掉并存盘；交回忘掉的文档 */
  forget(docs: string[]): string[];
}

export interface ServiceDeps {
  formats: Format[];
  reader: Reader;
  ledger: Ledger;
  comparator: Comparator;
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

export function createService({ formats, reader, ledger, comparator }: ServiceDeps): Service {
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

  function resolveRefs(doc: string, references: Reference[]): Listing {
    const look = observerCache();
    const seen = new Set<string>();
    const items: Item[] = references.map((reference) => {
      const target = reference.target;
      const text = look(target);
      const record = ledger.get(doc, target);
      const judged = comparator.judge(record, target, text);
      seen.add(targetKey(target));
      const current = judged.status === "missing" ? null : currentOf(target, text, judged.lines);
      const item: Item = { doc, reference, current, record, status: judged.status, lines: judged.lines };
      if (judged.reason !== undefined) item.reason = judged.reason;
      if (judged.diff !== undefined) item.diff = judged.diff;
      if (judged.old !== undefined) item.old = judged.old;
      // 判定说「有内容」但这会儿切不出来（行段跟到文件外）：宁可报缺失，别拿空段冒充新鲜
      if (item.current === null && item.status !== "missing") {
        item.status = "missing";
        item.reason = "vanished";
      }
      return item;
    });
    const orphans = ledger
      .list(doc)
      .filter(({ target }) => !seen.has(targetKey(target)))
      .map(({ target, record }) => ({ doc, target, record }));
    return { doc, items, orphans };
  }

  function resolve(doc: string, text: string): Listing {
    return resolveRefs(doc, needFormat(doc).parse(text));
  }

  /**
   * 确认：先让比较器逐条出记录，**有一处出 problem 就整篇拒**——一条都不写，记录簿和文档都不动。
   * 行段按「今天的行段」记：判定跟到哪儿就钉到哪儿，引用的键跟着换，旧键当孤儿一并清掉。
   */
  function confirm(doc: string, text: string): ConfirmResult {
    const format = needFormat(doc);
    const listing = resolve(doc, text);
    const look = observerCache();
    const problems: string[] = [];
    const pending: Array<{ target: Target; record: MemoRecord; fill: Fill }> = [];

    for (const item of listing.items) {
      const was = item.reference.target;
      const target: Target =
        was.kind === "span" && item.status !== "missing" ? { kind: "span", file: was.file, a: item.lines[0], b: item.lines[1] } : was;
      const seen = look(target);
      const snapshot = comparator.snapshot(target, seen);
      if ("problem" in snapshot) {
        problems.push(`${doc} 第 ${item.reference.at + 1} 行：${snapshot.problem}`);
        continue;
      }
      const current = currentOf(target, seen, target.kind === "span" ? [target.a, target.b] : item.lines);
      if (current === null) {
        problems.push(`${doc} 第 ${item.reference.at + 1} 行：${targetKey(target)} 切不出内容`);
        continue;
      }
      pending.push({ target, record: snapshot.record, fill: { reference: { ...item.reference, target }, current } });
    }

    if (problems.length > 0) return { listing, text, changed: false, problems, pinned: [] };

    const kept = new Set<string>();
    for (const { target, record } of pending) {
      ledger.set(doc, target, record);
      kept.add(targetKey(target));
    }
    // 孤儿：文档里已经没有的引用，外加行段跟随之后被换掉的旧键
    for (const { target } of ledger.list(doc)) {
      if (!kept.has(targetKey(target))) ledger.remove(doc, target);
    }
    ledger.save();

    const fills = pending.map((p) => p.fill);
    const next = fills.length > 0 ? format.write(text, fills) : text;
    return { listing, text: next, changed: next !== text, problems: [], pinned: pending.map(({ target, record }) => ({ target, record })) };
  }

  function strays(docs: string[]): string[] {
    const keep = new Set(docs);
    return ledger.docs().filter((doc) => !keep.has(doc));
  }

  function forget(docs: string[]): string[] {
    const gone = strays(docs);
    for (const doc of gone) for (const { target } of ledger.list(doc)) ledger.remove(doc, target);
    ledger.save();
    return gone;
  }

  return { formatFor, resolve, resolveRefs, confirm, strays, forget };
}
