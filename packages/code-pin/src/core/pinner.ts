/**
 * 钉码核心对外的两个动作，只收钉（目标与记录）：
 *   check(pins)                   核对：每处交回状态、今天的位置、给人看的旧行新行，不写任何东西
 *   confirm(checks, { accept })   确认：按核对的结果逐处决定要不要重新记、记成什么
 *
 * 结果带着传进来的那个钉对象（`PinCheck.pin`、`ConfirmStep.check`），调用方挂在钉上的东西原样带回。
 * 每处的记录各自独立：一处钉不住只是那一处不动。
 */

import { judge, snapshot } from "./compare.ts";
import type { HunksOf } from "./compare.ts";
import { hunksOf } from "./diff.ts";
import type { Hunk } from "./diff.ts";
import { sliceSpan } from "./span.ts";
import { fileOf } from "./types.ts";
import type { History, Pin, PinCheck, Reader, RecordedPin, Span, Target } from "./types.ts";

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

export interface ConfirmStep<P extends Pin = Pin> {
  check: PinCheck<P>;
  action: ConfirmAction;
  /** recorded / moved / accepted：新的目标与记录 */
  written?: RecordedPin;
  /** refused 且不是因为红（钉不住）时的原因；红的原因看 check.reason */
  problem?: string;
}

export interface ConfirmOptions {
  /** 黄灯按今天的内容重新记 */
  accept: boolean;
}

export interface Pinner {
  check<P extends Pin>(pins: readonly P[]): PinCheck<P>[];
  confirm<P extends Pin>(checks: readonly PinCheck<P>[], options: ConfirmOptions): ConfirmStep<P>[];
}

export interface PinnerDeps {
  reader: Reader;
  history: History;
}

type Look = (target: Target) => string[] | null;

/** 目标的观察：行段 / 整文件看文件的行，目录树看名字表 */
function observe(reader: Reader, target: Target): string[] | null {
  if (target.kind === "tree") return reader.list?.(target.dir, target.depth, target.glob) ?? null;
  return reader.read(fileOf(target)!);
}

/** 观察的键：同一次核对里同一样东西只看一遍 */
function observeKey(target: Target): string {
  if (target.kind === "tree") return `tree ${target.dir} ${target.depth} ${target.glob ?? ""}`;
  return `file ${fileOf(target)}`;
}

/** 这一处「当前是什么」：行段 / 整文件切那几行，目录树是名字表 */
function currentOf(target: Target, text: string[] | null, lines: Span): string[] | null {
  return target.kind === "tree" ? text : sliceSpan(text, lines);
}

const sameSpan = (a: Span, b: Span): boolean => a[0] === b[0] && a[1] === b[1];

/** 同一对整文件内容只算一次 hunk 表：几十处钉同一个文件是常态 */
function rememberedHunks(): HunksOf {
  const byOld = new Map<string, Map<string, Hunk[]>>();
  return (oldText, newText) => {
    let byNew = byOld.get(oldText);
    if (byNew === undefined) {
      byNew = new Map();
      byOld.set(oldText, byNew);
    }
    let hunks = byNew.get(newText);
    if (hunks === undefined) {
      hunks = hunksOf(oldText.split("\n"), newText.split("\n"));
      byNew.set(newText, hunks);
    }
    return hunks;
  };
}

export function createPinner({ reader, history }: PinnerDeps): Pinner {
  function rememberedLook(): Look {
    const cache = new Map<string, string[] | null>();
    return (target) => {
      const key = observeKey(target);
      if (!cache.has(key)) cache.set(key, observe(reader, target));
      return cache.get(key) ?? null;
    };
  }

  function checkOf<P extends Pin>(pin: P, look: Look, hunks: HunksOf): PinCheck<P> {
    const text = look(pin.target);
    const judged = judge(pin.target, pin.record, text, history, hunks);
    const current = judged.status === "missing" ? null : currentOf(pin.target, text, judged.lines);
    // 判定说「有内容」但这会儿切不出来（行段跟到文件外）：宁可报缺失，别拿空段冒充新鲜
    if (current === null && judged.status !== "missing") return { ...judged, pin, current, status: "missing", reason: "vanished" };
    return { ...judged, pin, current };
  }

  /** 按今天的样子重新记一处：行段钉到判定跟到的位置 */
  function rerecord(check: PinCheck, look: Look): { written: RecordedPin } | { problem: string } {
    const was = check.pin.target;
    const target: Target = was.kind === "span" ? { kind: "span", file: was.file, a: check.lines[0], b: check.lines[1] } : was;
    const taken = snapshot(target, look(target));
    if ("problem" in taken) return taken;
    return { written: { target, record: taken.record } };
  }

  function stepOf<P extends Pin>(check: PinCheck<P>, accept: boolean, look: Look): ConfirmStep<P> {
    const target = check.pin.target;
    const redo = (action: ConfirmAction): ConfirmStep<P> => {
      const done = rerecord(check, look);
      return "problem" in done ? { check, action: "refused", problem: done.problem } : { check, action, written: done.written };
    };
    switch (check.status) {
      case "missing":
        return { check, action: "refused" };
      case "unconfirmed":
        return redo("recorded");
      case "changed":
        return accept ? redo("accepted") : { check, action: "needs-accept" };
      case "fresh":
        return target.kind === "span" && !sameSpan([target.a, target.b], check.lines) ? redo("moved") : { check, action: "unchanged" };
    }
  }

  return {
    check(pins) {
      const look = rememberedLook();
      const hunks = rememberedHunks();
      return pins.map((pin) => checkOf(pin, look, hunks));
    },
    confirm(checks, { accept }) {
      const look = rememberedLook();
      return checks.map((check) => stepOf(check, accept, look));
    },
  };
}
