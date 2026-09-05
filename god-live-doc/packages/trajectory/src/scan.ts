/**
 * 扫目录读卡文件——本包唯一碰 node:fs/promises 的地方。`.` 入口的其余部分（model / layout /
 * chains / parse / validate）都是纯函数，`./react` 客户端入口只吃它们，不会把这个文件的
 * 依赖打进浏览器包。
 * 逻辑出自老仓 `god-flow-panels` 的 `node/star/model.ts`（只读参考，本仓不 import 它）；
 * 扫描目录由调用方显式传入，不假设任何固定的实例工作目录布局。
 */

import { readdir, readFile, stat } from "node:fs/promises";
import { join } from "node:path";

import { parseCardFile } from "./model.ts";
import type { RawCard, SickFile } from "./types.ts";

/** 扫盘产物：全部卡 + 按文件归拢的报病。 */
export interface TrajectoryScan {
  cards: RawCard[];
  sick: SickFile[];
}

/** 扫一个目录里的卡：目录不存在或读不动一律回空集合，不报错、不建目录
 * ——空态就是「这里还没有轨迹记录」。目录内平铺不建子目录（card-format 正本已定），
 * 只扫一层。卡上记的 `path` 相对 `dir` 本身。 */
export async function scanDir(dir: string): Promise<TrajectoryScan> {
  let names: string[];
  try {
    names = await readdir(dir);
  } catch {
    return { cards: [], sick: [] };
  }
  const cards: RawCard[] = [];
  const sick: SickFile[] = [];
  const files = names.filter((n) => n.endsWith(".md")).sort();
  await Promise.all(
    files.map(async (name) => {
      const abs = join(dir, name);
      let text: string;
      let mtime: number;
      try {
        [text, mtime] = await Promise.all([
          readFile(abs, "utf8"),
          stat(abs).then((s) => s.mtimeMs),
        ]);
      } catch {
        /* 读的当口文件没了：当这张不存在 */
        return;
      }
      const id = name.slice(0, -3);
      const parsed = parseCardFile(id, name, mtime, text);
      if (!parsed.card) return;
      cards.push(parsed.card);
      if (parsed.problems.length) sick.push({ path: parsed.card.path, problems: parsed.problems });
    }),
  );
  /* Promise.all 的完成序不定，身份序钉死：同一份目录两次扫描产物逐位相等 */
  cards.sort((a, b) => a.id.localeCompare(b.id));
  sick.sort((a, b) => a.path.localeCompare(b.path));
  return { cards, sick };
}
