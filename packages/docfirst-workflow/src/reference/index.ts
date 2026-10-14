/**
 * 引用在文档里的位置与核对结果的类型：一处引用在文档里的位置、一篇核对完的清单、格式接口。
 *
 * 钉码核心只收目标与记录，文档路径、第几行都定义在这儿，由钉码编排（`../pinning/`）配回去；
 * 各格式认出的引用、按原文渲染要读的清单也是这几个类型。
 *
 * 这个目录只认识 `@godcreator/code-pin`，不认识 workflow 里别的目录（由 `tests/boundary.test.ts` 检查）。
 */
import type { MemoRecord, Reason, Span, Status, Target } from "../legacy-code-pin/index.ts";

/** 文档里的一处引用 */
export interface Reference {
  target: Target;
  /** 记号上带的记录；还没确认的记号不带记录属性，是 null */
  record: MemoRecord | null;
  /** 在文档里第几行（0 起）——写回和渲染靠它定位 */
  at: number;
}

/** 确认后要写回的一处：一定带着记录，写成正式记号 */
export interface WrittenReference {
  target: Target;
  record: MemoRecord;
  at: number;
}

/**
 * 一种文档格式：认领哪些文件、从全文认出引用、把确认后的记录写回全文。
 * 一个文件只能有一个格式认领；记号里那一截由记号写法（`../marker/`）定，格式只管外壳在文件里长什么样
 */
export interface Format {
  /** 出错时说是哪个格式 */
  name: string;
  /** 这个文件归不归它：file 是相对项目根、正斜杠的路径 */
  claims(file: string): boolean;
  parse(text: string): Reference[];
  /** 只重写每处引用所在的那一行，别的一个字节不动 */
  write(text: string, written: WrittenReference[]): string;
}

/** 清单项：一处引用核对完的全部信息，钉码核心的判定配回这处引用 */
export interface Item {
  doc: string;
  reference: Reference;
  /** 当前内容：行段 / 整文件是那几行（归一化过），目录树是名字表；读不到是 null */
  current: string[] | null;
  status: Status;
  /** 行段今天在文件里的位置——跟过 hunk 或滑窗的结果，可能跟记号上写的不一样。别的种类是 [1, 项数] */
  lines: Span;
  reason?: Reason;
  /** 有变动且取得到旧内容时给人看的 `- / +` 文本 */
  diff?: string;
  /** 确认时那段是什么；取得到旧内容时才有 */
  old?: string[];
}

/** 一篇文档核对完的结果，渲染器和命令行只读它 */
export interface Listing {
  doc: string;
  items: Item[];
}
