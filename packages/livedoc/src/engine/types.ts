/**
 * 接口正本。判定层跟外面说话，只用这里定义的几种数据。
 *
 * **只有接口与域类型**：记号怎么写、记录簿的键怎么编解码住 `./marker.ts`——两份的变化原因
 * 不一样，这一份因「引用能指向什么」而变，那一份因「记号怎么写」而变。
 *
 * 用词：
 *   引用 Reference    文档里的一处声明：我说的是某文件某几行 / 整个文件 / 某目录的形状 / 某路径在不在 / 某文件里有没有某名字
 *   目标 Target       引用指向什么，五种（见下）
 *   记录 MemoRecord   确认时记下的「当时的指纹」；带 kind，比较器只认自己那种
 *   清单 Listing      一篇文档核对完的结果，渲染器和命令行只吃它
 *   状态 Status       核对的结果，四种；外加记录簿里的孤儿记录
 */

/** 行段：文件 + 起止行（1 起，闭区间）。「这几行长这样」 */
export interface SpanTarget {
  kind: "span";
  file: string;
  a: number;
  b: number;
}

/** 整文件。「这个文件长这样」——末尾追加也算变 */
export interface FileTarget {
  kind: "file";
  file: string;
}

/** 目录树：目录下有哪些名字（不看内容）。depth 默认 1 只列直接子项；glob 只留名字匹配的 */
export interface TreeTarget {
  kind: "tree";
  dir: string;
  depth: number;
  glob?: string;
}

/** 存在性：这个路径在（absent 为真时：断言它不在） */
export interface ExistsTarget {
  kind: "exists";
  path: string;
  absent: boolean;
}

/** 名字：文件里有没有一行含这个字面量 */
export interface HasTarget {
  kind: "has";
  file: string;
  text: string;
}

export type Target = SpanTarget | FileTarget | TreeTarget | ExistsTarget | HasTarget;

/** 文档里的一处引用 */
export interface Reference {
  target: Target;
  /** 在文档里第几行（0 起）——身份不靠它，写回和渲染靠它定位 */
  at: number;
  /** 格式自留的私货（展示区在哪、是不是草稿记号），判定层原样带回 */
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
  /** 当前内容：行段 / 整文件是那几行（归一化过），目录树是名字表，存在性是类型；读不到是 null */
  current: string[] | null;
  record: MemoRecord | null;
  status: Status;
  /** 行段今天在文件里的位置——比较器跟过 diff 的结果，可能跟记号上写的不一样。别的种类是 [1, 项数] */
  lines: Span;
  /**
   * 状态的细分理由：
   *   缺失  vanished / file-missing / blob-missing / dir-missing / appeared（断言不在，它却在）/ type-changed / text-missing
   *   变动  changed / unlocated（hash 记忆找不到这段了，位置不明）
   */
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

/** 确认时交给格式写回的一处：引用（行段已经跟到今天）+ 该填进展示区的内容（存在性、名字没有展示区，给空） */
export interface Fill {
  reference: Reference;
  current: string[];
}

/**
 * 格式接口——一种文档格式一个实现，判定层只认前五样。
 * 作者不用记各格式的记号：写记号语法（engine/marker.ts）定的草稿记号（见 draftOf），确认时格式换成正式形态。
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
  /** 渲染：出一份给 AI 读的 md。渲染只有这一种目标——人看的那份就是文档在站上的样子 */
  renderAi?(text: string, listing: Listing, ctx: RenderContext): string | Promise<string>;
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

/**
 * 读取器：判定层不碰磁盘，看到的一切都从这儿来。
 *   read     整文件按行读，读不到给 null
 *   list     目录下的名字表：相对 dir 的 posix 路径，目录带尾斜杠，排过序；只到 depth 层；glob 只留名字匹配的；目录不在给 null
 *   kindOf   路径是文件还是目录；不在给 null
 */
export interface Reader {
  read(file: string): string[] | null;
  list?(dir: string, depth: number, glob?: string): string[] | null;
  kindOf?(path: string): "file" | "dir" | null;
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
 * 行段 / 整文件有三个实现——`git`（任何 git 仓里已提交的文件：记 blob，按 hunk 跟行段）、`hash`（不在 git 里的
 * 文件：只记段哈希，按滑窗跟行段）、`auto`（默认，住 host 那层：按文件位置挑前两个，核对时按记录的 kind 转发）。
 * 目录树、存在性、名字各一个实现，住判定层（它们只看读取器给的观察）；createKindComparator 按目标种类分派。
 * 它不读文件：观察由判定层从读取器取好了递进来（行段 / 整文件 / 名字是文件的行，目录树是名字表，
 * 存在性是 ["file"] / ["dir"]；取不到是 null）。
 * 记录认不认是它自己的事：别家 kind 的记录交回「未确认」，判定层不看 kind。
 */
export interface Comparator {
  kind: string;
  /** 确认时出记录；git 版在这儿把「已提交」的门守住 */
  snapshot(target: Target, text: string[] | null): Snapshot;
  /** 核对时判；行段可能跟到新位置 */
  judge(record: MemoRecord | null, target: Target, text: string[] | null): Judgement;
}

/** 引用指向的文件（行段、整文件、名字）；目录树和存在性不是文件，给 null */
export function fileOf(target: Target): string | null {
  return target.kind === "span" || target.kind === "file" || target.kind === "has" ? target.file : null;
}


