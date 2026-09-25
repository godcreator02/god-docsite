/**
 * git 是记忆，也是 diff 引擎。
 *
 * - 钉住只对**已提交**的内容做：blob 从 `HEAD:<file>` 取，它被提交树引用、永远不会被 gc
 * - 变没变、变到哪：`git diff -U0` 旧内容对当前内容，解析 hunk 头做行段映射——不自己写 diff 算法
 *
 * 被引文件在哪个仓，按**文件自己的位置**定（`locate`）：先取真实路径（pnpm 的 `node_modules/@x/y` 是指向
 * 工作区包的软链，得按真实位置算），再从所在目录往上找第一个 `.git`——最里层那个，子模块算自己的仓。
 * 目标是**目录**时走 `locateDir`：从目录自身起找，不先跳一级（目录自己就可能是仓根）。
 * 项目自己的仓、别的仓一视同仁，所以 `HEAD:<rel>` 里的 rel 一律是**那个仓的仓根相对** posix 路径。
 */

import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, join, relative, resolve, sep } from "node:path";
import { parseHunks } from "../engine/index.ts";
import type { Hunk } from "../engine/index.ts";

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
 * 从**文件所在目录**起往上找：文件自己不可能是 `.git`，先跳一级才不会白问一次。 */
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

/** 这个仓有没有过一次提交（HEAD 存在）。刚 init 的仓 HEAD 还没生出来，什么都钉不住 */
export function hasCommits(repo: string): boolean {
  return headCommit(repo) !== null;
}

/** 工作区里这个文件相对 HEAD 有没有改动（含未跟踪） */
export function isClean({ repo, rel }: Located): boolean {
  return git(repo, ["status", "--porcelain", "--", rel]).trim() === "";
}

/** 这个文件是不是被 .gitignore（含全局忽略、info/exclude）忽略了。已跟踪的文件不算忽略 */
export function isIgnored({ repo, rel }: Located): boolean {
  try {
    git(repo, ["check-ignore", "-q", "--", rel]);
    return true;
  } catch (err) {
    // 退 1 是「没被忽略」，别的（退 128 之类）是真出错
    if ((err as { status?: number }).status === 1) return false;
    throw err;
  }
}

/**
 * HEAD 里这个文件的 blob 哈希；不在 HEAD 里（未跟踪、被忽略、路径大小写跟 git 记的不一样）给 null。
 * 「在不在 HEAD 里」跟「blob 是什么」是同一句 git 能回答的，问一次就够。
 */
export function headBlob({ repo, rel }: Located): string | null {
  try {
    return git(repo, ["rev-parse", `HEAD:${rel}`]).trim();
  } catch {
    return null;
  }
}

/** 仓的 HEAD commit；一次提交都还没有给 null。「有没有过提交」问的就是这一句，别再单独起一次 git */
export function headCommit(repo: string): string | null {
  try {
    return git(repo, ["rev-parse", "--verify", "-q", "HEAD"]).trim();
  } catch {
    return null;
  }
}

/**
 * 读到过的 blob 内容，键是「仓 + blob 名」。blob 名按内容寻址，同一个名字永远是同一份内容，
 * 记住不会给出过时的答案。同一次 check 里几十处引用钉同一个文件是常态，而 Windows 上起一次 git
 * 要 0.1 秒上下——不记住的话，同一个 blob 一次 check 能被读几十遍。
 * 只记读到了的：不在对象库里的 blob 下一次 fetch 就可能出现，记住「不在」等于把黄判成红。
 */
const blobCache = new Map<string, string>();

/** `cat-file --batch` 回话的头一行：`<名字> <类型> <字节数>`；对象不在时是 `<名字> missing` */
const BATCH_HEADER = /^([0-9a-f]+) (\w+) (\d+)$/;

/**
 * 对象库里这个 blob 的内容；不在对象库里（浅克隆 `--depth 1`、历史被重写后 gc 过）给 null。
 * 「在不在」和「是什么」用一次 `cat-file --batch` 一起问到，不分两趟起进程。
 * 回话按字节数切：内容里可能有任何字符，按行切会切错。
 */
export function readBlob(repo: string, blob: string): string | null {
  const key = `${repo}\0${blob}`;
  const known = blobCache.get(key);
  if (known !== undefined) return known;
  const out = execFileSync("git", ["cat-file", "--batch"], { cwd: repo, input: `${blob}\n`, ...LIMITS, stdio: ["pipe", "pipe", "pipe"] });
  const headerEnd = out.indexOf(0x0a);
  const header = out.subarray(0, headerEnd).toString("utf8");
  if (header === `${blob} missing`) return null;
  const parsed = BATCH_HEADER.exec(header);
  if (parsed === null || parsed[2] !== "blob") throw new Error(`${repo}：git cat-file --batch 对 ${blob} 的回话认不出（${header}），记录里的应当是一个 blob`);
  const start = headerEnd + 1;
  const text = out.subarray(start, start + Number(parsed[3])).toString("utf8");
  blobCache.set(key, text);
  return text;
}

/**
 * 一段文本的 blob 哈希，只算不写。
 *
 * git 的 blob 对象名就是 `sha1("blob " + 字节数 + "\0" + 内容)`，自己算跟 `git hash-object --stdin`
 * 逐字节相同（`tests/hash-text.test.ts` 拿真 git 对拍）。这条路每处行段引用都要走一遍，
 * 起子进程的话一次 check 光这一项就是几十次进程创建。
 */
export function hashText(text: string): string {
  return createHash("sha1").update(`blob ${Buffer.byteLength(text)}\0${text}`).digest("hex");
}

/** 算过的 hunk 表，键是「旧 blob 名 + 新内容的 blob 名」：两头都按内容寻址，同一对内容只 diff 一次 */
const hunkCache = new Map<string, Hunk[]>();

/**
 * 旧 blob 与当前文本之间的 hunk 表。两份写成临时文件 `diff --no-index`——被引文件可能在别人的仓里，
 * 不往任何对象库写东西。内容没变的那种不该走到这儿：调用方先比 `hashText`，一样就不必取旧内容。
 */
export function diffHunks(oldBlob: string, oldText: string, newText: string): Hunk[] {
  const key = `${oldBlob}\0${hashText(newText)}`;
  const known = hunkCache.get(key);
  if (known !== undefined) return known;
  const dir = mkdtempSync(join(tmpdir(), "docfirst-diff-"));
  try {
    writeFileSync(join(dir, "old"), oldText);
    writeFileSync(join(dir, "new"), newText);
    let out: string;
    try {
      out = git(dir, ["diff", "--no-index", "-U0", "--no-color", "--", "old", "new"]);
    } catch (err) {
      // 只有「有差异」这一种非零（退 1，输出在 stdout 里）能吞。别的吞了就是把红判成绿，照原样抛出去
      const e = err as { status?: number; stdout?: string };
      if (e.status !== 1) throw err;
      out = e.stdout ?? "";
    }
    const hunks = parseHunks(out);
    hunkCache.set(key, hunks);
    return hunks;
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}
