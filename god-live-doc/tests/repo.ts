/**
 * 测试夹具：临时目录里起一个真 git 仓，一份代码、几篇文档，按需换比较器装配核心服务。
 * 不走 loadProject——临时目录里解析不到包名；装配的零件（project 的读取器、比较器，内存记录簿）直接拿来用。
 */
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { createHashComparator, createService, targetKey, keyToTarget } from "@god-live-doc/core";
import type { Comparator, Format, Ledger, MemoRecord, Service } from "@god-live-doc/core";
import { createAutoComparator, createGitComparator, createReader } from "@god-live-doc/project";

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

/** 内存记录簿，够测试用；落盘那份在 @god-live-doc/project */
export function memoryLedger(): Ledger & { dump(): Record<string, Record<string, MemoRecord>> } {
  const data: Record<string, Record<string, MemoRecord>> = {};
  return {
    get: (doc, target) => data[doc]?.[targetKey(target)] ?? null,
    set(doc, target, record) {
      (data[doc] ??= {})[targetKey(target)] = record;
    },
    list: (doc) => Object.entries(data[doc] ?? {}).map(([key, record]) => ({ target: keyToTarget(key), record })),
    remove(doc, target) {
      delete data[doc]?.[targetKey(target)];
    },
    docs: () => Object.keys(data).filter((doc) => Object.keys(data[doc] ?? {}).length > 0),
    save() {},
    dump: () => data,
  };
}

export interface Repo {
  root: string;
  service: Service;
  ledger: ReturnType<typeof memoryLedger>;
  write(rel: string, text: string): void;
  read(rel: string): string;
  drop(rel: string): void;
  commit(message: string): void;
  statuses(doc: string, text: string): string[];
  teardown(): void;
}

export interface RepoOptions {
  formats: Format[];
  /** 不给就用 git 版；测试换比较器时传 "hash"、"auto" 或自己造的 */
  comparator?: Comparator | "hash" | "auto";
}

function comparatorOf(root: string, want: RepoOptions["comparator"]): Comparator {
  if (want === undefined) return createGitComparator({ root });
  if (want === "hash") return createHashComparator();
  if (want === "auto") return createAutoComparator({ root });
  return want;
}

/** 起一个临时 git 仓，代码已提交一次 */
export function setupRepo({ formats, comparator }: RepoOptions): Repo {
  const root = mkdtempSync(join(tmpdir(), "god-live-doc-"));
  run(root, ["init", "-q", "-b", "main"]);
  run(root, ["config", "user.email", "test@example.com"]);
  run(root, ["config", "user.name", "test"]);
  // 工作区一律 LF：Windows 上自动换行转换会让工作区和 blob 逐字节不同
  run(root, ["config", "core.autocrlf", "false"]);

  const api: Repo = {
    root,
    ledger: memoryLedger(),
    service: undefined as unknown as Service,
    write(rel, text) {
      mkdirSync(dirname(join(root, rel)), { recursive: true });
      writeFileSync(join(root, rel), text);
    },
    read: (rel) => readFileSync(join(root, rel), "utf8"),
    drop: (rel) => rmSync(join(root, rel), { force: true }),
    commit(message) {
      run(root, ["add", "-A"]);
      run(root, ["commit", "-q", "-m", message]);
    },
    statuses: (doc, text) => api.service.resolve(doc, text).items.map((i) => i.status),
    teardown: () => rmSync(root, { recursive: true, force: true, maxRetries: 5 }),
  };

  api.write("src/greet.ts", CODE);
  api.commit("起代码");
  api.service = createService({
    formats,
    reader: createReader(root),
    ledger: api.ledger,
    comparator: comparatorOf(root, comparator),
  });
  return api;
}
