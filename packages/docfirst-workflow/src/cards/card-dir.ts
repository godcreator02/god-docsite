/**
 * 读一个轨迹卡目录：列目录、读文件经 ../node/，挑卡、解析、校验、换成中性输入在 scan.ts。
 */

import { readDirFiles } from "../node/index.ts";
import { CARD_EXT, scanCards } from "./scan.ts";
import type { CardScan } from "./types.ts";

/** 扫一个目录里的卡：目录不存在回空集合、不建目录——空态就是「这里还没有轨迹记录」；别的读取失败原样抛出。
 * 目录内平铺，只扫一层。卡上记的 `path` 相对 `dir` 本身。
 * 两种后缀都读进来：同一身份 .md 与 .mdx 都在时，scanCards 只认 .mdx 并报病 */
export async function scanCardDir(dir: string): Promise<CardScan> {
  const files = await readDirFiles(dir, (name) => CARD_EXT.test(name));
  if (files === null) return { center: null, cards: [], sick: [] };
  return scanCards(files);
}
