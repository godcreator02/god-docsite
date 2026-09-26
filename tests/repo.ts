/**
 * 测试夹具：临时目录里起一个真 git 仓，一份代码、几篇文档，装配钉码编排。
 * 不走 loadProject——临时目录里解析不到包名；装配的零件（host 那层的读取器与旧内容来源）直接拿来用。
 */
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { createPinner } from "../packages/docfirst-pin/src/index.ts";
import type { History } from "../packages/docfirst-pin/src/index.ts";
import { formatPicker } from "../packages/docfirst-workflow/src/format/index.ts";
import type { DocFormat } from "../packages/docfirst-workflow/src/format/index.ts";
import { createPinning } from "../packages/docfirst-workflow/src/pinning/index.ts";
import type { ConfirmResult, Pinning } from "../packages/docfirst-workflow/src/pinning/index.ts";
import { createGitHistory, createReader } from "../packages/docfirst-workflow/src/project/index.ts";

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
export const NO_HISTORY: History = {
  oldText: () => null,
  hunks: () => {
    throw new Error("取不到旧内容，不该走到 hunk 表");
  },
};

export interface Repo {
  root: string;
  pinning: Pinning;
  write(rel: string, text: string): void;
  read(rel: string): string;
  drop(rel: string): void;
  commit(message: string): void;
  statuses(doc: string, text: string): string[];
  /** 确认一篇并把写回落盘（不带 --accept） */
  confirm(doc: string, accept?: boolean): ConfirmResult;
  teardown(): void;
}

export interface RepoOptions {
  formats: DocFormat[];
  /** 不给就用 git 版 */
  history?: History;
}

/**
 * 身份与换行策略用 `-c` 现传，不落 `git config`——每条 config 都是一个子进程，
 * 而夹具在整套测试里要起二十来次。工作区一律 LF：Windows 上自动换行转换会让工作区和 blob 逐字节不同。
 */
export const SETTINGS = ["-c", "user.email=test@example.com", "-c", "user.name=test", "-c", "core.autocrlf=false"];

/** 起一个临时 git 仓，代码已提交一次 */
export function setupRepo({ formats, history }: RepoOptions): Repo {
  const root = mkdtempSync(join(tmpdir(), "god-live-doc-"));
  run(root, ["init", "-q", "-b", "main"]);

  const api: Repo = {
    root,
    pinning: createPinning(createPinner({ reader: createReader(root), history: history ?? createGitHistory(root) }), formatPicker(formats)),
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
    statuses: (doc, text) => api.pinning.checkDoc(doc, text).items.map((i) => i.status),
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
