/**
 * 读一个轨迹卡目录：读盘在这儿，挑卡、解析、校验、换成中性输入在 scan.ts。
 */

import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { CARD_EXT, scanCards } from "./scan.ts";
import type { CardFile, CardScan } from "./types.ts";

/** 扫一个目录里的卡：目录不存在回空集合、不建目录——空态就是「这里还没有轨迹记录」；别的读取失败原样抛出。
 * 目录内平铺，只扫一层。卡上记的 `path` 相对 `dir` 本身。 */
export async function scanCardDir(dir: string): Promise<CardScan> {
  let names: string[];
  try {
    names = await readdir(dir);
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return { center: null, cards: [], sick: [] };
    throw err;
  }
  /* 两种后缀都读进来：同一身份 .md 与 .mdx 都在时，scanCards 只认 .mdx 并报病 */
  return scanCards(await readCardFiles(dir, names.filter((name) => CARD_EXT.test(name))));
}

/** 并发读卡文件的全文，读不了原样抛出 */
async function readCardFiles(dir: string, names: readonly string[]): Promise<CardFile[]> {
  return Promise.all(names.map(async (name): Promise<CardFile> => ({ name, text: await readFile(join(dir, name), "utf8") })));
}
