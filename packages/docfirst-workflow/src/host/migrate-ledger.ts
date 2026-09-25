/**
 * 一次性迁移：把旧记录簿 `.ledger.json` 里的记录写进各记号，然后删掉记录簿。
 * **各站迁完之后，下一个版本删掉这个文件和 `docfirst migrate-ledger` 命令。**
 *
 * 旧记录簿是 `{ 文档身份: { 目标键: 记录 } }`，目标键是 `targetKey` 的写法。记录按 kind 分五种，各迁成：
 *   git     { blob(40 位), commit, lines, hash(64 位) }   → hash、blob 各取前 12 位，行段按 lines 写
 *   hash    { lines, hash(64 位) }                        → 只写 hash，行段按 lines 写
 *   tree    { names }                                     → 名字表的哈希
 *   exists  { type }                                      → type
 *   has     {}                                            → 名字的正式记号本身就是确认过，不用写
 * 记录簿里有、文档里没有对应记号的（孤儿、文档已经不在）丢掉；记号在、记录不在的保持未确认；
 * 草稿记号和已经带着记录的记号不动。
 *
 * 不走 loadProject：迁移时配置里多半还留着旧键，装配会拒；这里只要配置里的 formats。
 */
import { existsSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { hashNames, RECORD_HASH_LENGTH, targetKey } from "../engine/index.ts";
import type { Format, MemoRecord, Reference, Target } from "../engine/index.ts";
import { configProblems, importConfig } from "./load.ts";

export interface MigrationReport {
  /** 记录簿的路径，相对项目根 */
  ledger: string;
  /** 每篇写进了几处记录；一处都没写的文档不列 */
  written: Array<{ doc: string; count: number }>;
  /** 丢掉的记录条数：文档已经不在，或文档里没有对应的记号 */
  dropped: number;
  /** 配置里还要手工改的地方，一条一句 */
  configAdvice: string[];
}

type LedgerData = Record<string, Record<string, Record<string, unknown>>>;

const HEX = (length: number): RegExp => new RegExp(`^[0-9a-f]{${length}}$`);

function readLedger(path: string): LedgerData {
  const data = JSON.parse(readFileSync(path, "utf8")) as unknown;
  const isTable = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);
  if (!isTable(data)) throw new Error(`${path}：记录簿要是 { 文档: { 目标键: 记录 } } 的对象`);
  for (const [doc, table] of Object.entries(data)) {
    if (!isTable(table)) throw new Error(`${path}：${doc} 底下要是 { 目标键: 记录 } 的对象`);
    for (const [key, record] of Object.entries(table)) {
      if (!isTable(record) || typeof record.kind !== "string") throw new Error(`${path}：${doc} 的 ${key} 不是一条带 kind 的记录`);
    }
  }
  return data as LedgerData;
}

function hexOf(record: Record<string, unknown>, field: string, length: number, where: string): string {
  const value = record[field];
  if (typeof value !== "string" || !HEX(length).test(value)) throw new Error(`${where}：记录的 ${field} 要是 ${length} 位十六进制`);
  return value.slice(0, RECORD_HASH_LENGTH);
}

function linesOf(record: Record<string, unknown>, where: string): [number, number] {
  const lines = record.lines;
  if (!Array.isArray(lines) || lines.length !== 2 || !lines.every((n) => Number.isInteger(n) && n >= 1) || lines[1] < lines[0]) {
    throw new Error(`${where}：记录的 lines 要是 [起, 止]`);
  }
  return lines as [number, number];
}

/** 一条旧记录 → 记号上的目标与记录；kind 跟记号的种类对不上就报错 */
function migrated(target: Target, record: Record<string, unknown>, where: string): { target: Target; record: MemoRecord } {
  const kind = record.kind as string;
  if ((kind === "git" || kind === "hash") && (target.kind === "span" || target.kind === "file")) {
    const hash = hexOf(record, "hash", 64, where);
    const content: MemoRecord = kind === "git" ? { kind: "content", hash, blob: hexOf(record, "blob", 40, where) } : { kind: "content", hash };
    if (target.kind === "file") return { target, record: content };
    const [a, b] = linesOf(record, where);
    return { target: { ...target, a, b }, record: content };
  }
  if (kind === "tree" && target.kind === "tree") {
    const names = record.names;
    if (!Array.isArray(names) || !names.every((name) => typeof name === "string")) throw new Error(`${where}：记录的 names 要是名字的数组`);
    return { target, record: { kind: "tree", hash: hashNames(names as string[]) } };
  }
  if (kind === "exists" && target.kind === "exists") {
    const allowed = target.absent ? ["absent"] : ["file", "dir"];
    if (typeof record.type !== "string" || !allowed.includes(record.type)) throw new Error(`${where}：记录的 type 要是 ${allowed.join(" / ")}`);
    return { target, record: { kind: "exists", type: record.type as "file" | "dir" | "absent" } };
  }
  throw new Error(`${where}：记录的 kind ${kind} 对不上这种记号（${target.kind}）`);
}

function formatOf(formats: Format[], doc: string): Format {
  const hits = formats.filter((format) => format.claims(doc));
  if (hits.length !== 1) throw new Error(`${doc}：${hits.length === 0 ? "没有格式认领这篇文档" : `${hits.map((f) => f.name).join("、")} 都认领了这篇`}`);
  return hits[0]!;
}

/** 一篇文档：把记录写进对应的记号，交回写了几处、用掉了哪些目标键 */
function migrateDoc(root: string, doc: string, format: Format, table: Record<string, Record<string, unknown>>): { count: number; used: Set<string> } {
  const path = join(root, doc);
  const text = readFileSync(path, "utf8");
  const used = new Set<string>();
  const updates: Reference[] = [];
  for (const reference of format.parse(text)) {
    if (reference.extra?.draft === true) continue;
    const key = targetKey(reference.target);
    const record = table[key];
    if (record === undefined) continue;
    used.add(key);
    if (reference.record !== null) continue;
    updates.push({ ...reference, ...migrated(reference.target, record, `${doc} 第 ${reference.at + 1} 行 ${key}`) });
  }
  if (updates.length > 0) writeFileSync(path, format.write(text, updates));
  return { count: updates.length, used };
}

export async function migrateLedger(root: string): Promise<MigrationReport> {
  const config = (await importConfig(root)) as { formats?: unknown; ledger?: unknown };
  if (!Array.isArray(config.formats)) throw new Error("docfirst.config 的 formats 要是格式的数组");
  const formats = config.formats as Format[];
  const ledger = typeof config.ledger === "string" ? config.ledger : ".ledger.json";
  const ledgerPath = join(root, ledger);
  if (!existsSync(ledgerPath)) throw new Error(`项目根下没有记录簿 ${ledger}——没有要迁的`);
  const data = readLedger(ledgerPath);

  const written: MigrationReport["written"] = [];
  let dropped = 0;
  for (const [doc, table] of Object.entries(data)) {
    const keys = Object.keys(table);
    if (!existsSync(join(root, doc))) {
      dropped += keys.length;
      continue;
    }
    const { count, used } = migrateDoc(root, doc, formatOf(formats, doc), table);
    dropped += keys.filter((key) => !used.has(key)).length;
    if (count > 0) written.push({ doc, count });
  }
  rmSync(ledgerPath);
  return { ledger, written, dropped, configAdvice: configProblems(config) };
}
