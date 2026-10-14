/**
 * 读一个轨迹卡目录：列目录、读文件在这里，挑卡、解析、校验、汇总在 core/。
 */

import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { scanCards } from "../core/card-set.ts";
import { CARD_EXT } from "../core/card-files.ts";
import type { CardFile, CardScan } from "../core/types.ts";

/** 目录下一层里的卡文件，并发读全文；目录不存在交回 null、不建目录，别的读取失败原样抛出 */
async function readCardFiles(dir: string): Promise<CardFile[] | null> {
  let names: string[];
  try {
    names = await readdir(dir);
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw err;
  }
  const cardNames = names.filter((name) => CARD_EXT.test(name));
  return Promise.all(cardNames.map(async (name) => ({ name, text: await readFile(join(dir, name), "utf8") })));
}

/** 扫一个目录里的卡，给命令行检查用：目录不存在回空集合、不建目录——空态就是「这里还没有轨迹记录」；别的读取失败原样抛出。
 * 目录内平铺，只扫一层。卡上记的 `path` 相对 `dir` 本身。 */
export async function scanCardDir(dir: string): Promise<CardScan> {
  const files = await readCardFiles(dir);
  if (files === null) return { center: null, cards: [], sick: [] };
  return scanCards(files);
}
