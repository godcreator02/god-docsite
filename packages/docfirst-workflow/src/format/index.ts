/**
 * 文档这一层的共用类型：一处引用在文档里的位置、一篇核对完的清单，以及按原文渲染拒绝时抛的错误。
 *
 * 钉码核心只收目标与记录，文档路径、第几行、是不是草稿都定义在这儿，由钉码编排（`../pinning/`）配回去；
 * mdx 格式认出的引用、按原文渲染要读的清单也是这几个类型。
 *
 * 这个目录只认识 `@godcreator/docfirst-pin`，不认识 workflow 里别的目录（`tests/boundary.test.ts` 守着）。
 */
import type { MemoRecord, Reason, Span, Status, Target } from "@godcreator/docfirst-pin";

/** 文档里的一处引用 */
export interface Reference {
  target: Target;
  /** 记号上带的记录；草稿记号、没写记录属性的正式记号是 null（未确认） */
  record: MemoRecord | null;
  /** 在文档里第几行（0 起）——写回和渲染靠它定位 */
  at: number;
  /** 还是草稿记号（没 confirm 过） */
  draft: boolean;
}

/** 清单项：一处引用核对完的全部信息，钉码核心的判定配回这处引用 */
export interface Item {
  doc: string;
  reference: Reference;
  /** 当前内容：行段 / 整文件是那几行（归一化过），目录树是名字表，名字是空表；读不到是 null */
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

/** 按原文渲染拒绝渲染（草稿记号、缺失的引用、组件、mdx 表达式）时抛它；摆放按这一类把它报成红，别的错照原样抛 */
export class RenderRefusal extends Error {
  override name = "RenderRefusal";
}

/** 认名字不认 instanceof：渲染与摆放可能各从一份产物加载，拿到的不是同一个类 */
export const isRenderRefusal = (err: unknown): err is RenderRefusal => err instanceof Error && err.name === "RenderRefusal";
