/**
 * git 那几样：定位文件在哪个仓、按 blob 名取旧内容、问工作区哪些文件有未提交的改动。
 *
 * 被钉文件在哪个仓，按文件自己的位置定（`locate`）：先取真实路径（pnpm 的 `node_modules/@x/y` 是指向
 * 工作区包的软链，得按真实位置算），再从所在目录往上找第一个 `.git`——最里层那个，子模块算自己的仓。
 * 目标是目录时走 `locateDir`：从目录自身起找（目录自己就可能是仓根）。rel 一律是那个仓的仓根相对 posix 路径。
 */

import { execFileSync } from "node:child_process";
import { existsSync, realpathSync } from "node:fs";
import { basename, dirname, join, relative, resolve, sep } from "node:path";

/** 每次调 git 都给上限：卡住的子进程比错误的答案更难查 */
const LIMITS = { timeout: 30_000, maxBuffer: 64 * 1024 * 1024 } as const;

export function git(cwd: string, args: string[]): string {
  return execFileSync("git", args, { cwd, encoding: "utf8", ...LIMITS, stdio: ["pipe", "pipe", "pipe"] });
}

/** 文件定位的结果：在哪个仓（仓根绝对路径，真实路径）、仓根相对的 posix 路径 */
export interface Located {
  repo: string;
  rel: string;
}

/** 真实路径；文件本身不存在（删了、还没建）就取最近一个存在的祖先的真实路径再拼回去 */
function realpathLoose(path: string): string {
  try {
    return realpathSync.native(path);
  } catch {
    const up = dirname(path);
    return up === path ? path : join(realpathLoose(up), basename(path));
  }
}

/** 从这个目录往上找第一个带 `.git` 的目录（.git 可能是目录，也可能是子模块 / worktree 里的文件）；没有就 null */
function repoOf(dir: string): string | null {
  let cur = dir;
  for (;;) {
    if (existsSync(join(cur, ".git"))) return cur;
    const up = dirname(cur);
    if (up === cur) return null;
    cur = up;
  }
}

function locatedAt(abs: string, searchFrom: string): Located | null {
  const repo = repoOf(searchFrom);
  if (repo === null) return null;
  return { repo, rel: relative(repo, abs).split(sep).join("/") };
}

/** 项目根 + 钉上写的路径 → 文件在哪个仓；不在任何仓里就 null。从文件所在目录起往上找 */
export function locate(root: string, file: string): Located | null {
  const abs = realpathLoose(resolve(root, file));
  return locatedAt(abs, dirname(abs));
}

/**
 * 同上，但目标是目录：从目录自身起往上找。目标目录恰好是仓根时（`tree .`），先跳一级就跳出了这个仓：
 * 仓根之上没有 `.git` 就回 null、.gitignore 过滤整个失效；之上另有一个仓时更糟——拿外层仓的忽略规则判内层仓的文件
 */
export function locateDir(root: string, dir: string): Located | null {
  const abs = realpathLoose(resolve(root, dir));
  return locatedAt(abs, abs);
}

/**
 * 读到过的 blob 内容，键是「仓 + blob 名前缀」。blob 名按内容寻址，一个前缀一旦认出唯一的对象，记住不会过时；
 * 同一次核对里几十处钉同一个文件是常态，Windows 上启动一次 git 要 0.1 秒上下。只记读到了的：不在对象库里的 blob 下一次 fetch 就可能出现
 */
const blobCache = new Map<string, string>();

/** `cat-file --batch` 输出的第一行：`<名字> <类型> <字节数>`；对象不在时是 `<名字> missing`，缩写有歧义时是 `<名字> ambiguous` */
const BATCH_HEADER = /^([0-9a-f]+) (\w+) (\d+)$/;

/**
 * 对象库里这个 blob 的内容，blob 可以是缩写。取不到给 null：不在对象库里（没提交过、浅克隆、历史重写后 gc 过）、
 * 缩写有歧义、缩写认出的不是 blob——都只是「没有旧内容」，由比较器退回滑窗。
 * 「在不在」和「是什么」用一次 `cat-file --batch` 一起问到；输出按字节数切分：内容里可能有任何字符，按行切会切错。
 */
export function readBlob(repo: string, blob: string): string | null {
  const key = `${repo}\0${blob}`;
  const known = blobCache.get(key);
  if (known !== undefined) return known;
  const out = execFileSync("git", ["cat-file", "--batch"], { cwd: repo, input: `${blob}\n`, ...LIMITS, stdio: ["pipe", "pipe", "pipe"] });
  const headerEnd = out.indexOf(0x0a);
  const header = out.subarray(0, headerEnd).toString("utf8");
  if (header === `${blob} missing` || header === `${blob} ambiguous`) return null;
  const parsed = BATCH_HEADER.exec(header);
  if (parsed === null) throw new Error(`${repo}：git cat-file --batch 对 ${blob} 的输出认不出（${header}）`);
  if (parsed[2] !== "blob") return null;
  const start = headerEnd + 1;
  const text = out.subarray(start, start + Number(parsed[3])).toString("utf8");
  blobCache.set(key, text);
  return text;
}

/** `git status --porcelain -z` 的一条：两位状态码、仓根相对路径；改名与复制那一条另带原路径 */
export interface StatusEntry {
  code: string;
  path: string;
  from?: string;
}

/** 把 `git status --porcelain -z` 的输出拆成一条条：字段以 NUL 分隔，改名与复制那一条后面多跟一个原路径字段 */
export function statusEntries(out: string): StatusEntry[] {
  const entries: StatusEntry[] = [];
  const fields = out.split("\0");
  for (let i = 0; i < fields.length; i += 1) {
    const field = fields[i]!;
    if (field.length < 4) continue;
    const entry: StatusEntry = { code: field.slice(0, 2), path: field.slice(3) };
    if (/[RC]/.test(entry.code)) {
      i += 1;
      if (fields[i] !== undefined && fields[i] !== "") entry.from = fields[i]!;
    }
    entries.push(entry);
  }
  return entries;
}

/**
 * 这个仓里有未提交改动的路径（仓根相对 posix）：工作区或暂存区跟 HEAD 不一样的、未跟踪的。
 * 未跟踪的目录逐个文件列出来；改名与复制前后的路径都算。
 * `--no-optional-locks`：status 默认会顺带刷新索引、要拿锁，加上它免得跟同时在这个仓里工作的人争锁。
 */
export function uncommittedPaths(repo: string): Set<string> {
  const out = git(repo, ["--no-optional-locks", "status", "--porcelain", "-z", "--untracked-files=all"]);
  const paths = new Set<string>();
  for (const { path, from } of statusEntries(out)) {
    paths.add(path);
    if (from !== undefined) paths.add(from);
  }
  return paths;
}
