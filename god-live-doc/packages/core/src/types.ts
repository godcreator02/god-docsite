/**
 * 接口正本。核心跟外面说话，只用这里定义的几种数据。
 *
 * 用词：
 *   引用 Reference    文档里的一处声明：我说的是某文件某几行
 *   记录 MemoRecord   确认时记下的「那几行当时的指纹」；带 kind，比较器只认自己那种
 *   清单 Listing      一篇文档核对完的结果，渲染器和命令行只吃它
 *   状态 Status       核对的结果，四种；外加记录簿里的孤儿记录
 */

/** 引用指向的代码：文件 + 起止行（1 起，闭区间）。第一里程碑只有这一种目标，kind 留给下一步的目录型、存在性引用 */
export interface Target {
  file: string;
  a: number;
  b: number;
}

/** 文档里的一处引用 */
export interface Reference {
  target: Target;
  /** 在文档里第几行（0 起）——身份不靠它，写回和渲染靠它定位 */
  at: number;
  /** 格式包自留的私货（展示区在哪、是不是草稿记号），核心原样带回 */
  extra?: Record<string, unknown>;
}

/** 确认记录。kind 是比较器的名字，别的字段归那个比较器自己定 */
export interface MemoRecord {
  kind: string;
  [key: string]: unknown;
}

/** 新鲜 / 有变动 / 缺失 / 未确认 */
export type Status = "fresh" | "changed" | "missing" | "unconfirmed";

/** 行段：1 起、闭区间 */
export type Span = [number, number];

/** 清单项：一处引用核对完的全部信息 */
export interface Item {
  doc: string;
  reference: Reference;
  /** 当前代码内容：此刻这段是什么（归一化过）；读不到是 null */
  current: string[] | null;
  record: MemoRecord | null;
  status: Status;
  /** 这段今天在文件里的位置——比较器跟过 diff 的结果，可能跟记号上写的不一样 */
  lines: Span;
  /** 状态的细分理由：vanished / file-missing / blob-missing / changed */
  reason?: string;
  /** 有变动时给人看的 `- / +` 文本 */
  diff?: string;
  /** 文档写下时那段是什么；缺失和有变动时才有 */
  old?: string[];
}

/** 记录簿里有、文档里已经没有的引用 */
export interface Orphan {
  doc: string;
  target: Target;
  record: MemoRecord;
}

export interface Listing {
  doc: string;
  items: Item[];
  orphans: Orphan[];
}

/** 确认时交给格式包写回的一处：引用（目标已经跟到今天）+ 该填进展示区的内容 */
export interface Fill {
  reference: Reference;
  current: string[];
}

/**
 * 格式包接口——每种文档格式一个包，核心只认前五样。
 * 作者不用记各格式的记号：写核心定的草稿记号（见 draftOf），确认时格式包换成正式形态。
 */
export interface Format {
  name: string;
  claims(doc: string): boolean;
  /** 正式记号和草稿记号都要认 */
  parse(text: string): Reference[];
  /** 确认时写回；草稿记号在这里换成正式形态 */
  write(text: string, fills: Fill[]): string;
  /** 一条引用在这种格式里的正式形态（一行）；parse(marker(t)) 必须认回 t */
  marker(target: Target): string;
  /** 名册外组件，给命令行 check 用 */
  lintComponents?(text: string, roster?: unknown): Array<{ name: string; line: number }>;
  renderAi?(text: string, listing: Listing, ctx: RenderContext): string | Promise<string>;
  renderHuman?(text: string, listing: Listing, ctx: RenderContext): string | Promise<string>;
  /** 文档本身就是终态产物（html）：人看它、AI 也读它，没有渲染这回事 */
  final?: boolean;
}

/** 渲染函数拿到的项目上下文：有自己管线的格式（fumadocs）靠 root + doc 自己去编译 */
export interface RenderContext {
  root: string;
  doc: string;
  roster?: unknown;
  config?: Record<string, unknown>;
}

/** 整文件按行读，读不到给 null */
export interface Reader {
  read(file: string): string[] | null;
}

export interface Ledger {
  get(doc: string, target: Target): MemoRecord | null;
  set(doc: string, target: Target, record: MemoRecord): void;
  list(doc: string): Array<{ target: Target; record: MemoRecord }>;
  remove(doc: string, target: Target): void;
  /** 簿里还有记录的全部文档——文档删了、挪了，它的记录没人逐篇去看，得靠这一览清掉 */
  docs(): string[];
  save(): void;
}

/** 确认时出记录，或者说清楚为什么钉不住 */
export type Snapshot = { record: MemoRecord } | { problem: string };

/** 核对的判定：状态 + 这段今天在哪 */
export interface Judgement {
  status: Status;
  lines: Span;
  reason?: string;
  diff?: string;
  old?: string[];
}

/**
 * 比较器：记忆怎么记、变没变怎么判，全在这儿。
 * 两个实现——`git`（产品用，记 blob，按 hunk 跟行段）、`hash`（只记段哈希，不跟行段）。
 * 它不读文件：当前整文件的内容由核心从读取器取好了递进来（读不到是 null）。
 */
export interface Comparator {
  kind: string;
  /** 确认时出记录；git 版在这儿把「已提交」的门守住 */
  snapshot(target: Target, text: string[] | null): Snapshot;
  /** 核对时判；行段可能跟到新位置 */
  judge(record: MemoRecord | null, target: Target, text: string[] | null): Judgement;
}

/**
 * 草稿记号——核心定的、所有格式通用的写法，独立一行：
 *   @@livedoc ref src/greet.ts:2-3 @@
 * 在 md、mdx、html 里都是合法的一行普通文字，作者在哪种文件里都这么写；check 认它、报未确认；
 * confirm 时格式包把它换成自己的正式形态，之后不再出现。头尾的 @@ 是哨兵，少一头就是普通文字，不报错。
 * 动作词现在只有 ref，`exists`、`tree` 留给下一步。
 */
const DRAFT = /^\s*@@livedoc\s+ref\s+(.+):(\d+)-(\d+)\s+@@\s*$/;

/** 这一行是不是草稿记号；是就交目标（经 toTarget 校验），不是给 null */
export function draftOf(line: string, where: string): Target | null {
  const m = DRAFT.exec(line);
  return m === null ? null : toTarget({ file: m[1]!, lines: `${m[2]}-${m[3]}` }, where);
}

/** 属性表 → 目标。语义校验统一住核心，各格式包报错一致 */
export function toTarget(attrs: Record<string, string | undefined>, where: string): Target {
  if (attrs.file === undefined || attrs.file === "") throw new Error(`${where}：引用要有 file="…"`);
  if (!/^\d+-\d+$/.test(attrs.lines ?? "")) throw new Error(`${where}：引用要有 lines="起-止"`);
  const [a, b] = attrs.lines!.split("-").map(Number) as [number, number];
  if (a < 1 || b < a) throw new Error(`${where}：行号不合理（${attrs.lines}）`);
  return { file: attrs.file, a, b };
}

/** 目标的文本形态，给报告和记录簿的键用 */
export const targetKey = (t: Target): string => `${t.file}:${t.a}-${t.b}`;

/** 记录簿的键 → 目标。跟 targetKey 是一对，文件名里有冒号也认得回来（取最后一个冒号） */
export function keyToTarget(key: string): Target {
  const m = /^(.*):(\d+)-(\d+)$/.exec(key);
  if (m === null) throw new Error(`记录簿里的键不认得：${key}`);
  return { file: m[1]!, a: Number(m[2]), b: Number(m[3]) };
}
