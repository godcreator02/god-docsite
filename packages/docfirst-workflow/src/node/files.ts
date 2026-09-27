/**
 * 读写文件、列目录。包里 node/ 以外的目录要碰磁盘都经这几个函数；它们不认识 docfirst 的任何格式，路径一律是绝对路径。
 */
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { readdir, readFile } from "node:fs/promises";
import { dirname, join } from "node:path";

export function pathExists(path: string): boolean {
  return existsSync(path);
}

export function isDirectory(path: string): boolean {
  return existsSync(path) && statSync(path).isDirectory();
}

export function readText(path: string): string {
  return readFileSync(path, "utf8");
}

/** 文件不在就交回 null */
export function readTextIfExists(path: string): string | null {
  return existsSync(path) ? readFileSync(path, "utf8") : null;
}

export function writeText(path: string, text: string): void {
  writeFileSync(path, text);
}

/** 写文件，父目录不在就先建 */
export function writeTextMakingParents(path: string, text: string): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, text);
}

/** 目录下一层的名字，不递归 */
export function namesIn(dir: string): string[] {
  return readdirSync(dir);
}

/** 目录下的全部文件（递归），绝对路径；按目录项自己的类型判断是不是目录，指向目录的软链接当成文件 */
export function filesUnder(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    return entry.isDirectory() ? filesUnder(path) : [path];
  });
}

/** 目录下的全部文件（递归），绝对路径；用 stat 判断是不是目录，指向目录的软链接会跟进去 */
export function filesUnderFollowingLinks(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? filesUnderFollowingLinks(path) : [path];
  });
}

/**
 * 一个目录下一层里 `accept` 挑中的文件，并发读全文；目录不存在交回 null、不建目录，别的读取失败原样抛出。
 * 交回的 `name` 是文件名，相对 `dir`。
 */
export async function readDirFiles(dir: string, accept: (name: string) => boolean): Promise<Array<{ name: string; text: string }> | null> {
  let names: string[];
  try {
    names = await readdir(dir);
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw err;
  }
  return Promise.all(names.filter(accept).map(async (name) => ({ name, text: await readFile(join(dir, name), "utf8") })));
}
