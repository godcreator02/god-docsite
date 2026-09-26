/**
 * 钉码核心对外的两个动作，只收目标与记录：
 *   check(pins)                     核对：每处交回状态、今天的位置、给人看的旧行新行，不写任何东西
 *   confirm(verdicts, { accept })   确认：按核对的结果逐处决定要不要重新记、记成什么
 *
 * 交回的结果与传入的顺序一一对应；这一处属于哪篇文档、在第几行，由调用方按顺序配回去。
 * 每处的记录各自独立：一处钉不住只是那一处不动。
 * 钉码核心不碰磁盘：每种目标要看的东西（观察）由读取器给，旧内容与 hunk 表由 History 给。
 */

import { judge, snapshot } from "./compare.ts";
import { sliceSpan } from "./span.ts";
import { fileOf } from "./types.ts";
import type { History, Pin, Reader, Span, Target, Verdict } from "./types.ts";

/**
 * 确认时对一处做什么：
 *   recorded       未确认的记上今天的记录
 *   moved          绿的行段挪了位置，记新行号与新记录
 *   accepted       带 accept 时，黄的按今天的内容重新记
 *   unchanged      绿的、原地没动，不记
 *   needs-accept   黄的、没带 accept，不记，等人复核
 *   refused        红的或钉不住的，不记
 */
export type ConfirmAction = "recorded" | "moved" | "accepted" | "unchanged" | "needs-accept" | "refused";

export interface Step {
  verdict: Verdict;
  action: ConfirmAction;
  /** recorded / moved / accepted：新的目标与记录 */
  written?: Pin;
  /** refused 且不是因为红（钉不住）时的原因；红的原因看 verdict.reason */
  problem?: string;
}

export interface ConfirmOptions {
  /** 黄灯按今天的内容重新记 */
  accept: boolean;
}

export interface Pinner {
  check(pins: Pin[]): Verdict[];
  confirm(verdicts: Verdict[], options: ConfirmOptions): Step[];
}

export interface PinnerDeps {
  reader: Reader;
  history: History;
}

/** 目标的观察：行段 / 整文件 / 名字看文件的行，目录树看名字表 */
function observe(reader: Reader, target: Target): string[] | null {
  if (target.kind === "tree") return reader.list?.(target.dir, target.depth, target.glob) ?? null;
  return reader.read(fileOf(target)!);
}

/** 观察的键：同一次核对里同一样东西只看一遍 */
function observeKey(target: Target): string {
  if (target.kind === "tree") return `tree ${target.dir} ${target.depth} ${target.glob ?? ""}`;
  return `file ${fileOf(target)}`;
}

/** 这一处「当前是什么」：行段 / 整文件切那几行，目录树是名字表，名字没有展示内容 */
function currentOf(target: Target, text: string[] | null, lines: Span): string[] | null {
  if (target.kind === "span" || target.kind === "file") return sliceSpan(text, lines);
  if (target.kind === "has") return text === null ? null : [];
  return text;
}

const sameSpan = (a: Span, b: Span): boolean => a[0] === b[0] && a[1] === b[1];

export function createPinner({ reader, history }: PinnerDeps): Pinner {
  function observerCache(): (target: Target) => string[] | null {
    const cache = new Map<string, string[] | null>();
    return (target) => {
      const key = observeKey(target);
      if (!cache.has(key)) cache.set(key, observe(reader, target));
      return cache.get(key) ?? null;
    };
  }

  function verdictOf(pin: Pin, look: (target: Target) => string[] | null): Verdict {
    const text = look(pin.target);
    const judged = judge(pin.target, pin.record, text, history);
    const current = judged.status === "missing" ? null : currentOf(pin.target, text, judged.lines);
    const verdict: Verdict = { pin, status: judged.status, lines: judged.lines, current };
    if (judged.reason !== undefined) verdict.reason = judged.reason;
    if (judged.diff !== undefined) verdict.diff = judged.diff;
    if (judged.old !== undefined) verdict.old = judged.old;
    // 判定说「有内容」但这会儿切不出来（行段跟到文件外）：宁可报缺失，别拿空段冒充新鲜
    if (verdict.current === null && verdict.status !== "missing") {
      verdict.status = "missing";
      verdict.reason = "vanished";
    }
    return verdict;
  }

  /** 按今天的样子重新记一处：行段钉到判定跟到的位置 */
  function rerecord(verdict: Verdict, look: (target: Target) => string[] | null): { written: Pin } | { problem: string } {
    const was = verdict.pin.target;
    const target: Target = was.kind === "span" ? { kind: "span", file: was.file, a: verdict.lines[0], b: verdict.lines[1] } : was;
    const taken = snapshot(target, look(target));
    if ("problem" in taken) return taken;
    return { written: { target, record: taken.record } };
  }

  function stepOf(verdict: Verdict, accept: boolean, look: (target: Target) => string[] | null): Step {
    const target = verdict.pin.target;
    const redo = (action: ConfirmAction): Step => {
      const done = rerecord(verdict, look);
      return "problem" in done ? { verdict, action: "refused", problem: done.problem } : { verdict, action, written: done.written };
    };
    switch (verdict.status) {
      case "missing":
        return { verdict, action: "refused" };
      case "unconfirmed":
        return redo("recorded");
      case "changed":
        return accept ? redo("accepted") : { verdict, action: "needs-accept" };
      case "fresh":
        return target.kind === "span" && !sameSpan([target.a, target.b], verdict.lines) ? redo("moved") : { verdict, action: "unchanged" };
    }
  }

  return {
    check(pins) {
      const look = observerCache();
      return pins.map((pin) => verdictOf(pin, look));
    },
    confirm(verdicts, { accept }) {
      const look = observerCache();
      return verdicts.map((verdict) => stepOf(verdict, accept, look));
    },
  };
}
