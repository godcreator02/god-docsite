/**
 * 编排服务。三个动作：
 *   resolve(doc, text)        核对：调格式包认引用，出清单，不写任何东西
 *   resolveRefs(doc, refs)    同上，但引用已经有人认好了（有语法树的宿主用，跳过 parse）
 *   confirm(doc, text)        确认：让比较器出记录、刷记录簿、清孤儿、让格式包写回
 *   strays / forget(docs)     文档本身删了、挪了，它的记录没人逐篇去看：按文档清单一览、整个忘掉
 *
 * 引用的身份 = 文档 + 引用写的目标；同一篇里指向同一段的两处引用共用一条记录。
 * 记录带 kind：比较器只认自己那种，换了比较器旧记录当「未确认」，不猜。
 */

import { sliceSpan } from "./span.ts";
import { targetKey } from "./types.ts";
import type { Comparator, Fill, Format, Item, Ledger, Listing, MemoRecord, Reader, Reference, Span, Target } from "./types.ts";

export interface ConfirmResult {
  listing: Listing;
  text: string;
  changed: boolean;
  /** 非空 = 一条都没写：整篇拒绝 */
  problems: string[];
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

export function createService({ formats, reader, ledger, comparator }: ServiceDeps): Service {
  /** 一篇文档只能有一个格式包认领；两个都认领是配置错误，报出来而不是靠顺序静默定胜负 */
  function formatFor(doc: string): Format | null {
    const hits = formats.filter((f) => f.claims(doc));
    if (hits.length > 1) {
      throw new Error(`${doc}：${hits.map((f) => f.name).join("、")} 都认领了这篇——一篇文档只能有一个格式包`);
    }
    return hits[0] ?? null;
  }

  function needFormat(doc: string): Format {
    const format = formatFor(doc);
    if (format === null) throw new Error(`${doc}：没有格式包认领这篇文档`);
    return format;
  }

  /** 记录簿里的记录，只有 kind 对得上才算数——换比较器等于换记录格式，旧记录一律当没确认过 */
  function recordFor(doc: string, target: Target): MemoRecord | null {
    const record = ledger.get(doc, target);
    return record !== null && record.kind === comparator.kind ? record : null;
  }

  /** 一次核对里同一个文件只读一遍 */
  function readerCache(): (file: string) => string[] | null {
    const cache = new Map<string, string[] | null>();
    return (file) => {
      if (!cache.has(file)) cache.set(file, reader.read(file));
      return cache.get(file) ?? null;
    };
  }

  function resolveRefs(doc: string, references: Reference[]): Listing {
    const read = readerCache();
    const seen = new Set<string>();
    const items: Item[] = references.map((reference) => {
      const text = read(reference.target.file);
      const record = recordFor(doc, reference.target);
      const judged = comparator.judge(record, reference.target, text);
      seen.add(targetKey(reference.target));
      const current = judged.status === "missing" ? null : sliceSpan(text, judged.lines);
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
   * 记录按「今天的行段」记：判定跟到哪儿就钉到哪儿，引用的键跟着换，旧键当孤儿一并清掉。
   */
  function confirm(doc: string, text: string): ConfirmResult {
    const format = needFormat(doc);
    const listing = resolve(doc, text);
    const read = readerCache();
    const problems: string[] = [];
    const pending: Array<{ target: Target; record: MemoRecord; fill: Fill }> = [];

    for (const item of listing.items) {
      const file = item.reference.target.file;
      const lines: Span = item.status === "missing" ? [item.reference.target.a, item.reference.target.b] : item.lines;
      const target: Target = { file, a: lines[0], b: lines[1] };
      const fileLines = read(file);
      const snapshot = comparator.snapshot(target, fileLines);
      if ("problem" in snapshot) {
        problems.push(`${doc} 第 ${item.reference.at + 1} 行：${snapshot.problem}`);
        continue;
      }
      const current = sliceSpan(fileLines, lines);
      if (current === null) {
        problems.push(`${doc} 第 ${item.reference.at + 1} 行：${targetKey(target)} 切不出内容`);
        continue;
      }
      pending.push({ target, record: snapshot.record, fill: { reference: { ...item.reference, target }, current } });
    }

    if (problems.length > 0) return { listing, text, changed: false, problems };

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
    return { listing, text: next, changed: next !== text, problems: [] };
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
