/**
 * git 是记忆，也是 diff 引擎。
 *
 * - 钉住只对**已提交**的内容做：blob 从 `HEAD:<file>` 取，它被提交树引用、永远不会被 gc
 * - 变没变、变到哪：`git diff -U0 <旧 blob> <当前内容>`，解析 hunk 头做行段映射——不自己写 diff 算法
 *
 * 路径口径：`status -- <rel>` 是 **cwd 相对**的，cwd = 项目根就对得上；但 `HEAD:<rel>` 是
 * **仓根相对**的——项目根可以是 git 的子目录，那儿的 rel 必须先翻成仓根相对（见 `gitRel`），
 * 否则 `HEAD:src/…` 会在仓根找不存在的路径、把已提交的内容判成「不在 HEAD 里」。
 */

import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, join, relative, resolve, sep } from "node:path";
import { parseHunks } from "@god-live-doc/core";
import type { Hunk } from "@god-live-doc/core";

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

/** 找 git 根：从项目根往上第一个带 `.git` 的目录（.git 可能是目录，也可能是子模块 / worktree 里的文件） */
function gitRootOf(repoRoot: string): string {
  let dir = repoRoot;
  for (;;) {
    if (existsSync(join(dir, ".git"))) return dir;
    const up = dirname(dir);
    if (up === dir) return repoRoot; // 没有 .git 就退化成项目根自己
    dir = up;
  }
}

/** `HEAD:<rel>` 一类路径是仓根相对——项目根在 git 子目录时把 rel 翻成仓根相对 posix */
export function gitRel(repoRoot: string, rel: string): string {
  return relative(gitRootOf(repoRoot), resolve(repoRoot, rel)).split(sep).join("/");
}

/** 工作区里这个文件相对 HEAD 有没有改动（含未跟踪） */
export function isClean(repoRoot: string, rel: string): boolean {
  return git(repoRoot, ["status", "--porcelain", "--", rel]).trim() === "";
}

/** HEAD 里这个文件的 blob 哈希 */
export function headBlob(repoRoot: string, rel: string): string {
  return git(repoRoot, ["rev-parse", `HEAD:${gitRel(repoRoot, rel)}`]).trim();
}

export function headCommit(repoRoot: string): string {
  return git(repoRoot, ["rev-parse", "HEAD"]).trim();
}

export function readBlob(repoRoot: string, blob: string): string {
  return git(repoRoot, ["cat-file", "-p", blob]);
}

/**
 * 这个对象还在不在对象库里。浅克隆（`--depth 1`）、历史被重写后 gc 过的仓，记录里的 blob 会失踪——
 * 那时候一切从 blob 取内容的活都得先问一句，别让 git 的非零退出炸穿上层。
 */
export function objectExists(repoRoot: string, id: string): boolean {
  try {
    git(repoRoot, ["cat-file", "-e", id]);
    return true;
  } catch {
    return false;
  }
}

/** HEAD 的树里有没有这个路径（大小写也得跟 git 记的一样） */
export function inHead(repoRoot: string, rel: string): boolean {
  return objectExists(repoRoot, `HEAD:${gitRel(repoRoot, rel)}`);
}

/** 一段文本的 blob 哈希；`write` 为真才真写进对象库（否则只算，不留松散对象） */
export function hashText(repoRoot: string, text: string, write = false): string {
  return git(repoRoot, write ? ["hash-object", "-w", "--stdin"] : ["hash-object", "--stdin"], text).trim();
}

/**
 * 旧 blob 与一段文本之间的 hunk 表。
 *
 * 先**只算哈希不写**：绿灯（内容一个字没改）是常态，那趟直接回空表，对象库里不留东西。
 * 真有差异才把文本存成松散对象（gc 会回收，它只是这次比较的临时输入），再 `diff -U0` 两个 blob。
 */
export function diffHunks(repoRoot: string, oldBlob: string, newText: string): Hunk[] {
  if (hashText(repoRoot, newText) === oldBlob) return [];
  const newBlob = hashText(repoRoot, newText, true);
  let out: string;
  try {
    out = git(repoRoot, ["diff", "-U0", "--no-color", oldBlob, newBlob]);
  } catch (err) {
    // 只有「有差异」这一种非零（退 1，输出在 stdout 里）能吞。别的（旧 blob 不在对象库里退 128
    // 之类）吞了就是把红判成绿，照原样抛出去
    const e = err as { status?: number; stdout?: string };
    if (e.status !== 1) throw err;
    out = e.stdout ?? "";
  }
  return parseHunks(out);
}
