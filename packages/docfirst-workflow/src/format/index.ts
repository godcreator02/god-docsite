/**
 * 文档这一层的共用类型与格式接口：一处引用在文档里的位置、一篇核对完的清单，
 * 以及格式要交的几样本事——认领、认引用、写回、正式记号，加两样可选的名册检查与按原文渲染。
 *
 * 钉码核心只收目标与记录，文档路径、第几行、是不是草稿都定义在这儿，由钉码编排（`../pinning/`）配回去。
 * 一个格式不实现两样可选的本事也能挂进项目：只核对、不查名册、不渲染。
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

export interface DocFormat {
  name: string;
  claims(doc: string): boolean;
  /** 正式记号和草稿记号都要认；正式记号上的记录属性一并读出 */
  parse(text: string): Reference[];
  /** 确认时写回：把每处引用所在那一行换成 marker(目标, 记录)；草稿记号在这里换成正式形态 */
  write(text: string, references: Reference[]): string;
  /** 一条引用在这种格式里的正式形态（一行）；parse(marker(t, r)) 必须认回 t 与 r */
  marker(target: Target, record: MemoRecord | null): string;
  /** 名册外组件，给命令行 check 用；roster 是项目 docfirst.config 里声明的组件名册 */
  lintComponents?(text: string, roster?: unknown): Array<{ name: string; line: number }>;
  /** 渲染：按原文出一份给 AI 读的 md，记号换成清单里今天的内容。正本里有渲染不了的东西时抛 RenderRefusal */
  renderAi?(text: string, listing: Listing): string;
}

/** 按文档名挑格式：一篇文档只能有一个格式认领，两个都认领是配置错误，报出来而不是靠顺序静默定胜负 */
export function formatPicker(formats: DocFormat[]): (doc: string) => DocFormat | null {
  return (doc) => {
    const hits = formats.filter((f) => f.claims(doc));
    if (hits.length > 1) throw new Error(`${doc}：${hits.map((f) => f.name).join("、")} 都认领了这篇——一篇文档只能有一个格式`);
    return hits[0] ?? null;
  };
}

/** renderAi 拒绝渲染（草稿记号、缺失的引用、组件、mdx 表达式）时抛它；摆放按这一类把它报成红，别的错照原样抛 */
export class RenderRefusal extends Error {
  override name = "RenderRefusal";
}

/** 认名字不认 instanceof：格式与宿主可能各从一份产物加载，拿到的不是同一个类 */
export const isRenderRefusal = (err: unknown): err is RenderRefusal => err instanceof Error && err.name === "RenderRefusal";
