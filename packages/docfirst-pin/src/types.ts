/**
 * 接口正本。钉码跟外面说话，只用这里定义的几种数据。
 *
 * **只有接口与域类型**：记号怎么写、记录怎么翻成属性住 `./marker.ts`——两份的变化原因
 * 不一样，这一份因「引用能指向什么」而变，那一份因「记号怎么写」而变。
 *
 * 用词：
 *   引用 Reference    文档里的一处声明：我说的是某文件某几行 / 整个文件 / 某目录的形状 / 某文件里有没有某名字
 *   目标 Target       引用指向什么，四种（见下）
 *   记录 MemoRecord   确认时写在正式记号上的属性（hash、blob 名这类），按目标种类各一种
 *   清单 Listing      一篇文档核对完的结果，渲染器和命令行只读它
 *   状态 Status       核对的结果，四种
 */
import type { Hunk } from "./diff.ts";

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

/** 名字：文件里有没有一行含这个字面量 */
export interface HasTarget {
  kind: "has";
  file: string;
  text: string;
}

export type Target = SpanTarget | FileTarget | TreeTarget | HasTarget;

/**
 * 行段与整文件的记录：段哈希，加确认时整文件的 blob 名（两样都是 12 位十六进制前缀）。
 * blob 缺省只出现在从旧记录簿的 hash 记录迁过来的记号上：没有它就取不到旧内容，只能滑窗找
 */
export interface ContentRecord {
  kind: "content";
  hash: string;
  blob?: string;
}

/** 目录树的记录：名字表的哈希。旧名字表不存，变了只知道变了 */
export interface TreeRecord {
  kind: "tree";
  hash: string;
}

/** 名字的记录：正式记号本身就是确认过 */
export interface HasRecord {
  kind: "has";
}

export type MemoRecord = ContentRecord | TreeRecord | HasRecord;

/** 文档里的一处引用 */
export interface Reference {
  target: Target;
  /** 记号上带的记录；草稿记号、没写记录属性的正式记号是 null（未确认） */
  record: MemoRecord | null;
  /** 在文档里第几行（0 起）——写回和渲染靠它定位 */
  at: number;
  /** 格式自留的私货（是不是草稿记号），钉码原样带回 */
  extra?: Record<string, unknown>;
}

/** 新鲜 / 有变动 / 缺失 / 未确认 */
export type Status = "fresh" | "changed" | "missing" | "unconfirmed";

/**
 * 状态的细分理由：
 *   缺失  vanished（整段删光）/ file-missing / dir-missing / text-missing
 *   变动  changed / unlocated（取不到旧内容，滑窗也找不到这段，位置不明）
 */
export type Reason = "vanished" | "file-missing" | "dir-missing" | "text-missing" | "changed" | "unlocated";

/**
 * 细分理由的中文说法，命令行打印与渲染拒绝的提示共用：红说清楚引用的是什么东西不在了，黄说清楚是不是找不着了。
 * `changed` 就是状态「有变动」本身，没有另外的说法
 */
export const REASON_TEXT: Record<Exclude<Reason, "changed">, string> = {
  vanished: "整段已被删光",
  "file-missing": "文件不在了",
  "dir-missing": "目录不在了",
  "text-missing": "文件里没有这个名字了",
  unlocated: "取不到确认时的内容，这段也找不到了，位置不明——重读源码后 --accept",
};

/** 行段：1 起、闭区间 */
export type Span = [number, number];

/** 清单项：一处引用核对完的全部信息 */
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

export interface Listing {
  doc: string;
  items: Item[];
}

/**
 * 格式接口——一种文档格式一个实现。钉码只要这四样：认领、认引用、写回、出正式记号。
 * 作者不用记各格式的记号：写记号语法（marker.ts）定的草稿记号（见 draftOf），确认时格式换成正式形态。
 */
export interface Format {
  name: string;
  claims(doc: string): boolean;
  /** 正式记号和草稿记号都要认；正式记号上的记录属性一并读出 */
  parse(text: string): Reference[];
  /** 确认时写回：把每处引用所在那一行换成 marker(目标, 记录)；草稿记号在这里换成正式形态 */
  write(text: string, references: Reference[]): string;
  /** 一条引用在这种格式里的正式形态（一行）；parse(marker(t, r)) 必须认回 t 与 r */
  marker(target: Target, record: MemoRecord | null): string;
}

/**
 * 读取器：钉码不碰磁盘，看到的一切都从这儿来。
 *   read     整文件按行读，读不到给 null
 *   list     目录下的名字表：相对 dir 的 posix 路径，目录带尾斜杠，排过序；只到 depth 层；glob 只留名字匹配的；目录不在给 null
 */
export interface Reader {
  read(file: string): string[] | null;
  list?(dir: string, depth: number, glob?: string): string[] | null;
}

/**
 * 旧内容的来源，行段与整文件的比较器只从这儿取不纯的两样：
 *   oldText   按 (文件, blob 名前缀) 取确认时的整文件内容；取不到给 null
 *   hunks     两段整文件文本之间的 hunk 表
 */
export interface History {
  oldText(file: string, blob: string): string | null;
  hunks(oldText: string, newText: string): Hunk[];
}

/** 确认时出记录，或者说清楚为什么钉不住 */
export type Snapshot = { record: MemoRecord } | { problem: string };

/** 核对的判定：状态 + 这段今天在哪 */
export interface Judgement {
  status: Status;
  lines: Span;
  reason?: Reason;
  diff?: string;
  old?: string[];
}

/** 引用指向的文件（行段、整文件、名字）；目录树不是文件，给 null */
export function fileOf(target: Target): string | null {
  return target.kind === "span" || target.kind === "file" || target.kind === "has" ? target.file : null;
}
