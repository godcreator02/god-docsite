/** 读取器：读工作区文件，整文件按行给。换成读某个提交、读内存，再写一个这样的文件即可 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { Reader } from "@god-live-doc/core";

export function createReader(root: string): Reader {
  return {
    read(file) {
      try {
        return readFileSync(join(root, file), "utf8").split("\n");
      } catch {
        return null;
      }
    },
  };
}
