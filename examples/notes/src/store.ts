/** 读写 notes.json：所有读写都走这里，别的文件不许自己碰文件 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import config from "../config.json" with { type: "json" };

export interface Note {
  text: string;
  at: string;
}

export function load(): Note[] {
  if (!existsSync(config.file)) return [];
  return JSON.parse(readFileSync(config.file, "utf8")) as Note[];
}

/** 每次把整个文件重写一遍，不是追加：notes.json 永远是一份完整的 JSON */
export function save(notes: Note[]): void {
  const json = JSON.stringify(notes, null, 2);
  writeFileSync(config.file, json);
}
