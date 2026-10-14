/**
 * 一篇文档的核对与确认：按文件挑格式，格式认出标记，钉交给钉码核心判定；确认时把算出的新记录交回同一个格式写回。
 * 读文档、写文档由调用方做：这里收全文、交回改好的全文。
 */
import type { ConfirmOptions, ConfirmStep, Pinner } from "./pinner.ts";
import type { MemoRecord, Pin, PinCheck, Target } from "./types.ts";

/** 文档里的一处钉：多带标记所在的行（1 起），写回和报告靠它 */
export interface DocPin extends Pin {
  line: number;
}

/**
 * 一种文档格式：认领哪些文件、从全文认出钉、把确认后的记录写回全文。
 * 一个文件只能有一个格式认领；标记里那一截的写法归 marker.ts，格式只管外壳在文件里长什么样
 */
export interface PinFormat {
  /** 出错时说是哪个格式 */
  name: string;
  /** 这个文件归不归它：file 是相对项目根、正斜杠的路径 */
  claims(file: string): boolean;
  /** 认出全部钉；写坏的标记一次列全、报错只说到第几行 */
  parse(text: string): DocPin[];
  /** 只重写每处标记所在的那一行，别的一个字节不动 */
  write(text: string, written: Array<{ line: number; target: Target; record: MemoRecord }>): string;
}

export interface DocCheck {
  doc: string;
  checks: PinCheck<DocPin>[];
}

export interface DocConfirm extends DocCheck {
  /** 跟 checks 一一对应、同序 */
  steps: ConfirmStep<DocPin>[];
  /** 写回之后的全文；没有要写的就是原文 */
  text: string;
  changed: boolean;
}

export interface DocPinning {
  checkDoc(doc: string, text: string): DocCheck;
  /** 按核对的结果逐处决定写不写回、写回成什么，交回改好的全文；写盘归调用方 */
  confirmDoc(doc: string, text: string, options: ConfirmOptions): DocConfirm;
}

/** 这个文件归哪个格式；没有格式认领就报错。格式之间按扩展名与目录互斥 */
export function formatOf(file: string, formats: readonly PinFormat[]): PinFormat {
  const format = formats.find((f) => f.claims(file));
  if (format === undefined) throw new Error(`${file}：没有格式认领这个文件——${formats.map((f) => f.name).join("、")}都不认它`);
  return format;
}

/** 认钉；标记写错了的报错只说到第几行，这里补上是哪个文件再抛出 */
function pinsIn(format: PinFormat, doc: string, text: string): DocPin[] {
  try {
    return format.parse(text);
  } catch (err) {
    throw new Error(`${doc} ${(err as Error).message}`, { cause: err });
  }
}

export function createDocPinning(pinner: Pinner, formats: readonly PinFormat[]): DocPinning {
  return {
    checkDoc: (doc, text) => ({ doc, checks: pinner.check(pinsIn(formatOf(doc, formats), doc, text)) }),
    confirmDoc(doc, text, options) {
      const format = formatOf(doc, formats);
      const checks = pinner.check(pinsIn(format, doc, text));
      const steps = pinner.confirm(checks, options);
      const written = steps.flatMap((step) => (step.written === undefined ? [] : [{ line: step.check.pin.line, ...step.written }]));
      const next = written.length > 0 ? format.write(text, written) : text;
      return { doc, checks, steps, text: next, changed: next !== text };
    },
  };
}
