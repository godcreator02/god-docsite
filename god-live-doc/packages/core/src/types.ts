/**
 * 接口正本。核心跟外面说话，只用这里定义的几种数据。
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

/** 确认时交给格式包写回的一处：引用（行段已经跟到今天）+ 该填进展示区的内容（存在性、名字没有展示区，给空） */
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

/**
 * 读取器：核心不碰磁盘，看到的一切都从这儿来。
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
 * 文件：只记段哈希，按滑窗跟行段）、`auto`（默认，住 project：按文件位置挑前两个，核对时按记录的 kind 转发）。
 * 目录树、存在性、名字各一个实现，住核心（它们只看读取器给的观察）；createKindComparator 按目标种类分派。
 * 它不读文件：观察由核心从读取器取好了递进来（行段 / 整文件 / 名字是文件的行，目录树是名字表，
 * 存在性是 ["file"] / ["dir"]；取不到是 null）。
 * 记录认不认是它自己的事：别家 kind 的记录交回「未确认」，核心不看 kind。
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

/** 正式记号的动作词：ref / tree / exists / absent / has。格式包用它拼自己的外壳 */
export function wordOf(target: Target): string {
  if (target.kind === "span" || target.kind === "file") return "ref";
  if (target.kind === "exists") return target.absent ? "absent" : "exists";
  return target.kind;
}

/** 正式记号的属性表（有序），格式包按 key="value" 摆出来 */
export function attrsOf(target: Target): Array<[string, string]> {
  switch (target.kind) {
    case "span":
      return [["file", target.file], ["lines", `${target.a}-${target.b}`]];
    case "file":
      return [["file", target.file]];
    case "tree":
      return [["dir", target.dir], ["depth", String(target.depth)], ...(target.glob !== undefined ? [["glob", target.glob] as [string, string]] : [])];
    case "exists":
      return [["path", target.path]];
    case "has":
      return [["file", target.file], ["text", target.text]];
  }
}

/** 正式记号的载荷（所有格式共用的那一截）：`ref file="…" lines="a-b"`、`tree dir="…" depth="1"`…… 值里的引号写成 &quot; */
export function formalOf(target: Target): string {
  const attrs = attrsOf(target).map(([k, v]) => `${k}="${v.replace(/"/g, "&quot;")}"`);
  return [wordOf(target), ...attrs].join(" ");
}

/** 载荷 → 属性表。跟 formalOf 是一对 */
export function parseAttrs(s: string): Record<string, string> {
  const table: Record<string, string> = {};
  for (const m of s.matchAll(/(\w+)="([^"]*)"/g)) table[m[1]!] = m[2]!.replace(/&quot;/g, '"');
  return table;
}

/** 正式记号的载荷 → 目标：`ref file="…" lines="…"` 这种一整串。格式包把外壳剥掉后交给它 */
export function parseFormal(payload: string, where: string): Target | null {
  const m = /^(\w+)\s*(.*)$/s.exec(payload.trim());
  if (m === null) return null;
  return toTarget(m[1]!, parseAttrs(m[2]!), where);
}

const WORDS = new Set(["ref", "tree", "exists", "absent", "has"]);

/** 动作词 + 属性表 → 目标。语义校验统一住核心，各格式包报错一致；动作词不认识给 null */
export function toTarget(word: string, attrs: Record<string, string | undefined>, where: string): Target | null {
  if (!WORDS.has(word)) return null;
  if (word === "ref") {
    if (attrs.file === undefined || attrs.file === "") throw new Error(`${where}：引用要有 file="…"`);
    if (attrs.lines === undefined) return { kind: "file", file: attrs.file };
    if (!/^\d+-\d+$/.test(attrs.lines)) throw new Error(`${where}：lines 要写成 "起-止"（${attrs.lines}）`);
    const [a, b] = attrs.lines.split("-").map(Number) as [number, number];
    if (a < 1 || b < a) throw new Error(`${where}：行号不合理（${attrs.lines}）`);
    return { kind: "span", file: attrs.file, a, b };
  }
  if (word === "tree") {
    if (attrs.dir === undefined || attrs.dir === "") throw new Error(`${where}：目录树要有 dir="…"`);
    const depth = attrs.depth === undefined ? 1 : Number(attrs.depth);
    if (!Number.isInteger(depth) || depth < 1) throw new Error(`${where}：depth 要是正整数（${attrs.depth}）`);
    const target: TreeTarget = { kind: "tree", dir: attrs.dir.replace(/\/+$/, ""), depth };
    if (attrs.glob !== undefined && attrs.glob !== "") target.glob = attrs.glob;
    return target;
  }
  if (word === "exists" || word === "absent") {
    if (attrs.path === undefined || attrs.path === "") throw new Error(`${where}：${word} 要有 path="…"`);
    return { kind: "exists", path: attrs.path, absent: word === "absent" };
  }
  if (attrs.file === undefined || attrs.file === "") throw new Error(`${where}：has 要有 file="…"`);
  if (attrs.text === undefined || attrs.text === "") throw new Error(`${where}：has 要有 text="…"`);
  return { kind: "has", file: attrs.file, text: attrs.text };
}

/**
 * 草稿记号——核心定的、所有格式通用的写法，独立一行，头尾 @@ 是哨兵，少一头就是普通文字，不报错：
 *   @@livedoc ref src/greet.ts:2-3 @@          行段
 *   @@livedoc ref config.json @@               整文件
 *   @@livedoc tree src @@                      目录树；可带 depth=2、glob=*.test.ts
 *   @@livedoc exists src/store.ts @@           在；absent 是「断言不在」
 *   @@livedoc has src/store.ts "export function save" @@   文件里有这个字面量（带空格就用引号包）
 * 在 md、mdx、html 里都是合法的一行普通文字；check 认它、报未确认；confirm 时格式包换成自己的正式形态。
 */
const DRAFT = /^\s*@@livedoc\s+(\w+)\s+(.+?)\s+@@\s*$/;

/** 这一行是不是草稿记号；是就交目标（经 toTarget 校验），不是给 null */
export function draftOf(line: string, where: string): Target | null {
  const m = DRAFT.exec(line);
  if (m === null) return null;
  const word = m[1]!;
  const payload = m[2]!;
  if (word === "ref") {
    const span = /^(.+):(\d+)-(\d+)$/.exec(payload);
    return span === null ? toTarget("ref", { file: payload }, where) : toTarget("ref", { file: span[1]!, lines: `${span[2]}-${span[3]}` }, where);
  }
  if (word === "tree") {
    const [dir, ...opts] = payload.split(/\s+/);
    const attrs: Record<string, string> = { dir: dir! };
    for (const opt of opts) {
      const kv = /^(depth|glob)=(.+)$/.exec(opt);
      if (kv === null) throw new Error(`${where}：tree 的选项只有 depth= 和 glob=（${opt}）`);
      attrs[kv[1]!] = kv[2]!;
    }
    return toTarget("tree", attrs, where);
  }
  if (word === "exists" || word === "absent") return toTarget(word, { path: payload }, where);
  if (word === "has") {
    const m2 = /^(\S+)\s+(.+)$/.exec(payload);
    if (m2 === null) throw new Error(`${where}：has 要写成 has 文件 名字`);
    const raw = m2[2]!;
    const text = /^"(.*)"$/.exec(raw)?.[1] ?? raw;
    return toTarget("has", { file: m2[1]!, text }, where);
  }
  return null;
}

/**
 * 目标的文本形态，给报告和记录簿的键用：
 *   行段 `file:a-b`、整文件 `file:all`、目录树 `tree dir depth=1[ glob=…]`、存在性 `exists path` / `absent path`、
 *   名字 `has file "text"`（text 按 JSON 转义）
 */
export function targetKey(t: Target): string {
  switch (t.kind) {
    case "span":
      return `${t.file}:${t.a}-${t.b}`;
    case "file":
      return `${t.file}:all`;
    case "tree":
      return `tree ${t.dir} depth=${t.depth}${t.glob !== undefined ? ` glob=${t.glob}` : ""}`;
    case "exists":
      return `${t.absent ? "absent" : "exists"} ${t.path}`;
    case "has":
      return `has ${t.file} ${JSON.stringify(t.text)}`;
  }
}

/** 记录簿的键 → 目标。跟 targetKey 是一对；行段的文件名里有冒号也认得回来（取最后一个冒号） */
export function keyToTarget(key: string): Target {
  const tree = /^tree (.+?) depth=(\d+)(?: glob=(.+))?$/.exec(key);
  if (tree !== null) {
    const t: TreeTarget = { kind: "tree", dir: tree[1]!, depth: Number(tree[2]) };
    if (tree[3] !== undefined) t.glob = tree[3];
    return t;
  }
  const exists = /^(exists|absent) (.+)$/.exec(key);
  if (exists !== null) return { kind: "exists", path: exists[2]!, absent: exists[1] === "absent" };
  const has = /^has (.+?) ("(?:[^"\\]|\\.)*")$/.exec(key);
  if (has !== null) return { kind: "has", file: has[1]!, text: JSON.parse(has[2]!) as string };
  const all = /^(.*):all$/.exec(key);
  if (all !== null) return { kind: "file", file: all[1]! };
  const span = /^(.*):(\d+)-(\d+)$/.exec(key);
  if (span === null) throw new Error(`记录簿里的键不认得：${key}`);
  return { kind: "span", file: span[1]!, a: Number(span[2]), b: Number(span[3]) };
}
