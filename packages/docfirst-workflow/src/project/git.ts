/**
 * git 那几样：定位文件在哪个仓、按 blob 名取旧内容、出 hunk 表、问工作区哪些文件有未提交的改动。
 *
 * 被引文件在哪个仓，按**文件自己的位置**定（`locate`）：先取真实路径（pnpm 的 `node_modules/@x/y` 是指向
 * 工作区包的软链，得按真实位置算），再从所在目录往上找第一个 `.git`——最里层那个，子模块算自己的仓。
 * 目标是**目录**时走 `locateDir`：从目录自身起找，不先跳一级（目录自己就可能是仓根）。
 * 项目自己的仓、别的仓一视同仁，所以 rel 一律是**那个仓的仓根相对** posix 路径。
 */

import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, join, relative, resolve, sep } from "node:path";
import { hashText, parseHunks } from "@godcreator/code-pin";
import type { Hunk } from "@godcreator/code-pin";

/** 每次调 git 都给上限：卡住的子进程比错误的答案更难查 */
const LIMITS = { timeout: 30_000, maxBuffer: 64 * 1024 * 1024 } as const;

export function git(cwd: string, args: string[], input?: string): string {
  return execFileSync("git", args, {
    cwd,
    encoding: "utf8",
    ...LIMITS,
    ...(input !== undefined ? { input } : {}),
    stdio: ["pipe", "pipe", "pipe"],
  });
}

/** 文件定位的结果：在哪个仓（仓根绝对路径，真实路径）、仓根相对的 posix 路径 */
export interface Located {
  repo: string;
  rel: string;
}

/** 真实路径；文件本身不存在（删了、还没建）就取最近一个存在的祖先的真实路径再拼回去 */
export function realpathLoose(path: string): string {
  try {
    return realpathSync.native(path);
  } catch {
    const up = dirname(path);
    return up === path ? path : join(realpathLoose(up), basename(path));
  }
}

/** 从这个目录往上找第一个带 `.git` 的目录（.git 可能是目录，也可能是子模块 / worktree 里的文件）；没有就 null */
export function repoOf(dir: string): string | null {
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

/** 项目根 + 引用里写的路径 → 文件在哪个仓；不在任何仓里就 null。
 * 从**文件所在目录**起往上找：文件自己不可能是 `.git`，先上移一级省掉一次无用的查找。 */
export function locate(root: string, file: string): Located | null {
  const abs = realpathLoose(resolve(root, file));
  return locatedAt(abs, dirname(abs));
}

/** 同上，但目标是目录：从**目录自身**起往上找。
 * 目录不能套用 locate——目标目录恰好就是仓根时（文档里写 `tree .`、或写 `tree ..` 正好指到
 * 工作区那层仓根），先跳一级就跳出了这个仓：仓根之上没有 `.git` 就回 null、忽略集空掉，
 * `.gitignore` 过滤整个失效（树里冒出 node_modules/、dist/，换台机器项数还不一样）；
 * 之上另有一个仓时更糟——拿外层仓的忽略规则去判内层仓的文件，答案是错的。 */
export function locateDir(root: string, dir: string): Located | null {
  const abs = realpathLoose(resolve(root, dir));
  return locatedAt(abs, abs);
}

/**
 * 读到过的 blob 内容，键是「仓 + blob 名前缀」。blob 名按内容寻址，一个前缀一旦认出唯一的对象，
 * 记住不会给出过时的答案。同一次 check 里几十处引用钉同一个文件是常态，而 Windows 上启动一次 git
 * 要 0.1 秒上下。只记读到了的：不在对象库里的 blob 下一次 fetch 就可能出现。
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
  if (parsed === null) throw new Error(`${repo}：git cat-file --batch 对 ${blob} 的回话认不出（${header}）`);
  if (parsed[2] !== "blob") return null;
  const start = headerEnd + 1;
  const text = out.subarray(start, start + Number(parsed[3])).toString("utf8");
  blobCache.set(key, text);
  return text;
}

/** 算过的 hunk 表，键是「旧 blob 名 + 新内容的 blob 名」：两头都按内容寻址，同一对内容只 diff 一次 */
const hunkCache = new Map<string, Hunk[]>();

/**
 * hunk 表写入文件的那一层缓存。钉住的那段挪了位置、没人会去重新确认的引用，每次 check 都要为它 diff 一遍。
 * 键跟内存那层一样按内容寻址，同一对内容的 hunk 表永远不变，所以不用管失效，所有项目共用一份，
 * 放系统临时目录（被清掉只是下次重算）。
 */
const HUNK_DIR = join(tmpdir(), "docfirst-cache", "hunks");

function isHunk(value: unknown): value is Hunk {
  const h = value as Record<string, unknown>;
  return typeof value === "object" && value !== null && ["oldStart", "oldLen", "newStart", "newLen"].every((k) => Number.isInteger(h[k]));
}

function readDiskHunks(path: string): Hunk[] | undefined {
  if (!existsSync(path)) return undefined;
  const unreadable = `hunk 缓存文件认不出：${path}——删掉它再跑一次`;
  let parsed: unknown;
  try {
    parsed = JSON.parse(readFileSync(path, "utf8"));
  } catch (err) {
    throw new Error(unreadable, { cause: err });
  }
  if (!Array.isArray(parsed) || !parsed.every(isHunk)) throw new Error(unreadable);
  return parsed;
}

/** 先写临时文件再改名，别的进程读不到写了一半的文件。改名失败而别的进程已经写好了同一份，就算写过了 */
function writeDiskHunks(path: string, hunks: Hunk[]): void {
  mkdirSync(HUNK_DIR, { recursive: true });
  const temp = `${path}.${process.pid}.tmp`;
  writeFileSync(temp, JSON.stringify(hunks));
  try {
    renameSync(temp, path);
  } catch (err) {
    rmSync(temp, { force: true });
    if (!existsSync(path)) throw err;
  }
}

/**
 * 旧内容与当前文本之间的 hunk 表。两份写成临时文件 `diff --no-index`——被引文件可能在别人的仓里，
 * 不往任何对象库写东西。
 */
export function diffHunks(oldText: string, newText: string): Hunk[] {
  const key = `${hashText(oldText)}-${hashText(newText)}`;
  const known = hunkCache.get(key);
  if (known !== undefined) return known;
  const diskPath = join(HUNK_DIR, `${key}.json`);
  const stored = readDiskHunks(diskPath);
  if (stored !== undefined) {
    hunkCache.set(key, stored);
    return stored;
  }
  const dir = mkdtempSync(join(tmpdir(), "docfirst-diff-"));
  try {
    writeFileSync(join(dir, "old"), oldText);
    writeFileSync(join(dir, "new"), newText);
    let out: string;
    try {
      out = git(dir, ["diff", "--no-index", "-U0", "--no-color", "--", "old", "new"]);
    } catch (err) {
      // 只有「有差异」这一种非零退出（退出码 1，输出在 stdout 里）当正常结果处理。别的也这样处理就是把红判成绿，照原样抛出去
      const e = err as { status?: number; stdout?: string };
      if (e.status !== 1) throw err;
      out = e.stdout ?? "";
    }
    const hunks = parseHunks(out);
    hunkCache.set(key, hunks);
    writeDiskHunks(diskPath, hunks);
    return hunks;
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

/**
 * 这个仓里有未提交改动的路径（仓根相对 posix）：工作区或暂存区跟 HEAD 不一样的、未跟踪的。
 * 未跟踪的目录逐个文件列出来；改名与复制两头的路径都算。
 * `--no-optional-locks`：status 默认会顺带刷新索引、要拿锁，加上它免得跟同时在这个仓里工作的人争锁。
 */
export function uncommittedPaths(repo: string): Set<string> {
  const out = git(repo, ["--no-optional-locks", "status", "--porcelain", "-z", "--untracked-files=all"]);
  const paths = new Set<string>();
  const fields = out.split("\0");
  for (let i = 0; i < fields.length; i += 1) {
    const field = fields[i]!;
    if (field.length < 4) continue;
    paths.add(field.slice(3));
    // 改名与复制那一条后面多跟一个原路径字段
    if (/[RC]/.test(field.slice(0, 2))) {
      i += 1;
      if (fields[i] !== undefined && fields[i] !== "") paths.add(fields[i]!);
    }
  }
  return paths;
}
