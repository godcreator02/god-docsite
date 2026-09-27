/**
 * 读一个轨迹卡目录：读盘在这儿，挑卡、解析、校验、换成中性输入在 scan.ts。
 */

import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { pickCardFiles, scanCards } from "./scan.ts";
import type { CardFile, CardScan } from "./types.ts";

/** 扫一个目录里的卡：目录不存在或读不动一律回空集合，不报错、不建目录
 * ——空态就是「这里还没有轨迹记录」。目录内平铺，只扫一层。卡上记的 `path` 相对 `dir` 本身。 */
export async function scanCardDir(dir: string): Promise<CardScan> {
  let names: string[];
  try {
    names = await readdir(dir);
  } catch {
    return { center: null, cards: [], sick: [] };
  }
  return scanCards(await readCardFiles(dir, pickCardFiles(names)));
}

/** 并发读卡文件的全文；读的当口文件没了就当这张不存在 */
async function readCardFiles(dir: string, names: readonly string[]): Promise<CardFile[]> {
  const read = await Promise.all(
    names.map(async (name): Promise<CardFile | null> => {
      try {
        return { name, text: await readFile(join(dir, name), "utf8") };
      } catch {
        return null;
      }
    }),
  );
  return read.filter((file): file is CardFile => file !== null);
}
