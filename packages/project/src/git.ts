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
import { parseHunks } from "@godcreator02/live-doc-core";
import type { Hunk } from "@godcreator02/live-doc-core";

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
 * 从**文件所在目录**起往上找：文件自己不可能是 `.git`，先跳一级才不会白问一趟。 */
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
  try {
    git(repo, ["rev-parse", "--verify", "-q", "HEAD"]);
    return true;
  } catch {
    return false;
  }
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

/** HEAD 里这个文件的 blob 哈希 */
export function headBlob({ repo, rel }: Located): string {
  return git(repo, ["rev-parse", `HEAD:${rel}`]).trim();
}

export function headCommit(repo: string): string {
  return git(repo, ["rev-parse", "HEAD"]).trim();
}

export function readBlob(repo: string, blob: string): string {
  return git(repo, ["cat-file", "-p", blob]);
}

/**
 * 认得出的对象名：40 位十六进制。这种名字是内容寻址的，同一个名字永远指同一份内容，
 * 所以「在」这个答案可以记住；`HEAD:<路径>` 那种随分支动的名字不记。
 */
const OBJECT_ID = /^[0-9a-f]{40}$/;

/** 记住问过的「在」。只记 true：不在的对象下一次提交就可能出现，记住等于把黄判成红 */
const objectSeen = new Set<string>();

/**
 * 这个对象还在不在对象库里。浅克隆（`--depth 1`）、历史被重写后 gc 过的仓，记录里的 blob 会失踪——
 * 那时候一切从 blob 取内容的活都得先问一句，别让 git 的非零退出炸穿上层。
 *
 * 同一趟 check 里几十处引用问同一个 blob 是常态（一篇文档十几处引用钉的往往是同一个文件），
 * 而一个进程里起一次 git 要几十毫秒。答案「在」记进 `objectSeen`：被提交树引用的对象不会被 gc，
 * 存在过就一直在，记住不会给出比现问更旧的答案。
 */
export function objectExists(repo: string, id: string): boolean {
  const memoizable = OBJECT_ID.test(id);
  const key = `${repo}\0${id}`;
  if (memoizable && objectSeen.has(key)) return true;
  try {
    git(repo, ["cat-file", "-e", id]);
    if (memoizable) objectSeen.add(key);
    return true;
  } catch {
    return false;
  }
}

/** HEAD 的树里有没有这个路径（大小写也得跟 git 记的一样） */
export function inHead(at: Located): boolean {
  return objectExists(at.repo, `HEAD:${at.rel}`);
}

/**
 * 一段文本的 blob 哈希，只算不写。
 *
 * git 的 blob 对象名就是 `sha1("blob " + 字节数 + "\0" + 内容)`，自己算跟 `git hash-object --stdin`
 * 逐字节相同（`tests/hash-text.test.ts` 拿真 git 对拍）。这条路每处行段引用都要走一趟，
 * 起子进程的话一次 check 光这一项就是几十次进程创建。
 */
export function hashText(text: string): string {
  return createHash("sha1").update(`blob ${Buffer.byteLength(text)}\0${text}`).digest("hex");
}

/**
 * 旧 blob 与当前文本之间的 hunk 表。
 *
 * 先**只算哈希**：绿灯（内容一个字没改）是常态，那趟直接回空表。
 * 真有差异才把两份写成临时文件 `diff --no-index`——被引文件可能在别人的仓里，不往任何对象库写东西。
 */
export function diffHunks(repo: string, oldBlob: string, newText: string): Hunk[] {
  if (hashText(newText) === oldBlob) return [];
  const dir = mkdtempSync(join(tmpdir(), "livedoc-diff-"));
  try {
    writeFileSync(join(dir, "old"), readBlob(repo, oldBlob));
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
    return parseHunks(out);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}
