/**
 * 记录簿：一个 json，两层键：文档 → 目标 → 记录。
 * save 只在内容真变了才写盘：记录簿会被构建工具登记成依赖，白改一次 mtime 就是一次全站重编。
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { keyToTarget, targetKey } from "../engine/index.ts";
import type { Ledger, MemoRecord } from "../engine/index.ts";

type Data = Record<string, Record<string, MemoRecord>>;

export function createLedger(path: string): Ledger {
  const data: Data = existsSync(path) ? (JSON.parse(readFileSync(path, "utf8")) as Data) : {};
  let onDisk = JSON.stringify(data, null, 2);
  return {
    get: (doc, target) => data[doc]?.[targetKey(target)] ?? null,
    set(doc, target, record) {
      (data[doc] ??= {})[targetKey(target)] = record;
    },
    list: (doc) => Object.entries(data[doc] ?? {}).map(([key, record]) => ({ target: keyToTarget(key), record })),
    remove(doc, target) {
      const table = data[doc];
      if (table === undefined) return;
      delete table[targetKey(target)];
      if (Object.keys(table).length === 0) delete data[doc];
    },
    docs: () => Object.keys(data),
    save() {
      const next = JSON.stringify(data, null, 2);
      if (next === onDisk) return;
      writeFileSync(path, `${next}\n`);
      onDisk = next;
    },
  };
}
