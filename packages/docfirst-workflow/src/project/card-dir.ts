/**
 * 读一个轨迹卡目录：读盘在这儿，挑卡、解析、建模在 `@godcreator/docfirst-trajectory`（纯函数）。
 * 读完交给轨迹包的 `scanCards`，再对每张卡的正文查一遍「卡里不许钉码」（card-refs.ts），
 * 病按文件并进同一份 `sick`。
 */

import { readdir, readFile, stat } from "node:fs/promises";
import { join } from "node:path";
import { pickCardFiles, scanCards, stripFrontmatter } from "@godcreator/docfirst-trajectory";
import type { CardFile, SickFile, TrajectoryScan } from "@godcreator/docfirst-trajectory";
import { checkDocfirstRefs } from "./card-refs.ts";

/** 扫一个目录里的卡：目录不存在或读不动一律回空集合，不报错、不建目录
 * ——空态就是「这里还没有轨迹记录」。目录内平铺，只扫一层。卡上记的 `path` 相对 `dir` 本身。 */
export async function scanCardDir(dir: string): Promise<TrajectoryScan> {
  let names: string[];
  try {
    names = await readdir(dir);
  } catch {
    return { cards: [], sick: [] };
  }
  const files = await readCardFiles(dir, pickCardFiles(names));
  const scan = scanCards(files);
  return { cards: scan.cards, sick: withCardRefs(scan, files) };
}

/** 并发读卡文件的全文与修改时间；读的当口文件没了就当这张不存在 */
async function readCardFiles(dir: string, names: readonly string[]): Promise<CardFile[]> {
  const read = await Promise.all(
    names.map(async (name): Promise<CardFile | null> => {
      const abs = join(dir, name);
      try {
        const [text, mtime] = await Promise.all([readFile(abs, "utf8"), stat(abs).then((s) => s.mtimeMs)]);
        return { name, text, mtime };
      } catch {
        return null;
      }
    }),
  );
  return read.filter((file): file is CardFile => file !== null);
}

/** 每张卡的正文查一遍钉码记号，病追加在轨迹包卡校验的病后面，按 path 归拢、排序 */
function withCardRefs(scan: TrajectoryScan, files: readonly CardFile[]): SickFile[] {
  const textOf = new Map(files.map((file) => [file.name, file.text]));
  const byPath = new Map(scan.sick.map((file) => [file.path, [...file.problems]]));
  for (const card of scan.cards) {
    const problems = checkDocfirstRefs(stripFrontmatter(textOf.get(card.path)!));
    if (problems.length === 0) continue;
    const known = byPath.get(card.path);
    if (known === undefined) byPath.set(card.path, problems);
    else known.push(...problems);
  }
  return [...byPath]
    .map(([path, problems]) => ({ path, problems }))
    .sort((a, b) => a.path.localeCompare(b.path));
}
