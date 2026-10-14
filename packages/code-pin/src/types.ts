/**
 * 钉码对外说话用的数据。
 *
 * 用词：
 *   目标 Target       钉的是什么：某文件某几行 / 整个文件 / 某目录的形状
 *   记录 MemoRecord   确认时算出的属性（段哈希、blob 名），按目标种类各一种
 *   钉 Pin            目标 + 记录；没确认过的记录是 null
 *   核对结果 PinCheck  一处钉核对完的全部信息：状态、今天的位置、给人看的旧行新行
 */

/** 行段：文件 + 起止行（1 起，闭区间） */
export interface SpanTarget {
  kind: "span";
  file: string;
  a: number;
  b: number;
}

/** 整文件：末尾追加也算变 */
export interface FileTarget {
  kind: "file";
  file: string;
}

/** 目录树：目录下有哪些名字（不看内容）。depth 1 只列直接子项；glob 只留名字匹配的 */
export interface TreeTarget {
  kind: "tree";
  dir: string;
  depth: number;
  glob?: string;
}

export type Target = SpanTarget | FileTarget | TreeTarget;

/** 行段与整文件的记录：段哈希，加确认时整文件的 blob 名（都是 12 位十六进制前缀） */
export interface ContentRecord {
  kind: "content";
  hash: string;
  blob: string;
}

/** 目录树的记录：名字表的哈希。旧名字表不存，变了只知道变了 */
export interface TreeRecord {
  kind: "tree";
  hash: string;
}

export type MemoRecord = ContentRecord | TreeRecord;

/** 一处钉：钉的是什么，确认时记了什么；没确认过的记录是 null */
export interface Pin {
  target: Target;
  record: MemoRecord | null;
}

/** 确认过的一处钉：一定带着记录 */
export interface RecordedPin {
  target: Target;
  record: MemoRecord;
}

/** 新鲜 / 有变动 / 缺失 / 未确认 */
export type Status = "fresh" | "changed" | "missing" | "unconfirmed";

/**
 * 状态的细分理由：
 *   缺失  vanished（整段删光）/ file-missing / dir-missing
 *   变动  changed / unlocated（取不到旧内容，滑窗也找不到这段，位置不明）
 */
export type Reason = "vanished" | "file-missing" | "dir-missing" | "changed" | "unlocated";

/** 细分理由的中文说法；`changed` 就是状态「有变动」本身，没有另外的说法 */
export const REASON_TEXT: Record<Exclude<Reason, "changed">, string> = {
  vanished: "整段已被删光",
  "file-missing": "文件不在了",
  "dir-missing": "目录不在了",
  unlocated: "取不到确认时的内容，这段也找不到了，位置不明——重读源码后 --accept",
};

/** 行段：1 起、闭区间 */
export type Span = [number, number];

/** 给人看的对比里的一行：没动、删掉的旧行、加上的新行 */
export interface DiffLine {
  kind: "same" | "removed" | "added";
  text: string;
}

/**
 * 一处钉核对完的结果。`pin` 就是传进来的那个对象：调用方挂在钉上的东西（所在行、语法树节点）原样带回来，
 * 结果跟输入靠它对上，不靠位置去找。
 */
export interface PinCheck<P extends Pin = Pin> {
  pin: P;
  status: Status;
  /** 行段今天在文件里的位置——跟过 hunk 或滑窗的结果，可能跟钉上写的不一样。别的种类是 [1, 项数] */
  lines: Span;
  reason?: Reason;
  /** 当前内容：行段 / 整文件是那几行（归一化过），目录树是名字表；缺失时是 null */
  current: string[] | null;
  /** 有变动且取得到旧内容时，旧段与当前段逐行对比 */
  diff?: DiffLine[];
  /** 确认时那段是什么；取得到旧内容时才有 */
  old?: string[];
}

/**
 * 读取器：钉码核心不碰磁盘，看到的一切都从这儿来。
 *   read     整文件按行读，读不到给 null
 *   list     目录下的名字表：相对 dir 的 posix 路径，目录带尾斜杠，排过序；只到 depth 层；glob 只留名字匹配的；目录不在给 null
 */
export interface Reader {
  read(file: string): string[] | null;
  list?(dir: string, depth: number, glob?: string): string[] | null;
}

/** 旧内容的来源：按 (文件, blob 名前缀) 取确认时的整文件内容；取不到给 null */
export interface History {
  oldText(file: string, blob: string): string | null;
}

/** 确认时出记录，或者说清楚为什么钉不住 */
export type Snapshot = { record: MemoRecord } | { problem: string };

/** 目标指向的文件（行段、整文件）；目录树不是文件，给 null */
export function fileOf(target: Target): string | null {
  return target.kind === "tree" ? null : target.file;
}
