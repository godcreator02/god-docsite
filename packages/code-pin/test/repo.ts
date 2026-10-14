/**
 * 测试夹具：临时目录里建一个真 git 仓，一份代码已提交；文档的核对与确认用读工作区的读取器。
 */
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { createDocPinning, createPinner, mdxMarker, PIN_FORMATS } from "../src/core/index.ts";
import type { DocConfirm, DocPinning, History, Target } from "../src/core/index.ts";
import { createGitHistory, createReader } from "../src/node/index.ts";

export const CODE = [
  "// greet",
  "export function greet(name: string): string {",
  "  return `hello ${name}`;",
  "}",
  "",
  "export const VERSION = 1;",
  "",
].join("\n");

export function run(cwd: string, args: string[]): string {
  return execFileSync("git", args, { cwd, encoding: "utf8", timeout: 30_000, stdio: ["pipe", "pipe", "pipe"] });
}

/** 什么旧内容都取不到的来源：比较器只能滑窗 */
export const NO_HISTORY: History = { oldText: () => null };

/** 身份与换行策略用 `-c` 现传，不写进 `git config`；工作区一律 LF */
export const SETTINGS = ["-c", "user.email=test@example.com", "-c", "user.name=test", "-c", "core.autocrlf=false"];

/** 一处还没确认的钉那一行：不带记录的 mdx 标记 */
export const refLine = (target: Target): string => mdxMarker(target, null);

export interface Repo {
  root: string;
  pinning: DocPinning;
  write(rel: string, text: string): void;
  read(rel: string): string;
  drop(rel: string): void;
  commit(message: string): void;
  statuses(doc: string): string[];
  /** 确认一篇并把写回的结果写入文件 */
  confirm(doc: string, accept?: boolean): DocConfirm;
  teardown(): void;
}

/** 建一个临时 git 仓，代码已提交一次；history 不给就用 git 那份 */
export function setupRepo({ history }: { history?: History } = {}): Repo {
  const root = mkdtempSync(join(tmpdir(), "code-pin-repo-"));
  run(root, ["init", "-q", "-b", "main"]);

  const api: Repo = {
    root,
    pinning: createDocPinning(createPinner({ reader: createReader(root), history: history ?? createGitHistory(root) }), PIN_FORMATS),
    write(rel, text) {
      mkdirSync(dirname(join(root, rel)), { recursive: true });
      writeFileSync(join(root, rel), text);
    },
    read: (rel) => readFileSync(join(root, rel), "utf8"),
    drop: (rel) => rmSync(join(root, rel), { force: true }),
    commit(message) {
      run(root, [...SETTINGS, "add", "-A"]);
      run(root, [...SETTINGS, "commit", "-q", "-m", message]);
    },
    statuses: (doc) => api.pinning.checkDoc(doc, api.read(doc)).checks.map((c) => c.status),
    confirm(doc, accept = false) {
      const done = api.pinning.confirmDoc(doc, api.read(doc), { accept });
      if (done.changed) api.write(doc, done.text);
      return done;
    },
    teardown: () => rmSync(root, { recursive: true, force: true, maxRetries: 5 }),
  };

  api.write("src/greet.ts", CODE);
  api.commit("起代码");
  return api;
}
