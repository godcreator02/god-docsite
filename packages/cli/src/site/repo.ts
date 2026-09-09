/**
 * 目标仓这一头的事实：读它的 package.json、看它的 `.gitignore` 还缺哪几条、
 * 仓根哪几个文件会被第一次 render 覆盖，以及最后那一步落盘。
 *
 * 模块内部件，不在建站接口的面上。**只读不改**是这一层的纪律：缺什么、会覆盖什么都只报出来，
 * 替人改仓里已有的文件，出错时现场在哪都不好找。
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import type { TemplateFile } from "./template.ts";

/** 站的产物要忽略掉的那几条 */
export const GITIGNORE_LINES = ["docs-site/.next/", "docs-site/.source/", "docs-site/out/"];

/** 模板的 outputs 映射会往仓根摆的生成物：仓里已经有的，第一次 render 就会被覆盖 */
export const PLACED_FILES = ["README.md", "AGENTS.md"];

/** 仓根 package.json 里能认出来的那两样。读不动不挡事——名字退回目录名 */
export function readManifest(repoDir: string): { name?: unknown; title?: unknown } | null {
  const manifestPath = join(repoDir, "package.json");
  if (!existsSync(manifestPath)) return null;
  try {
    return JSON.parse(readFileSync(manifestPath, "utf8")) as { name?: unknown; title?: unknown };
  } catch {
    return null;
  }
}

/** 仓根 `src/index.ts` 的正文，没有就是 null——起手页那块钉不钉得成看它 */
export function readEntry(repoDir: string): string | null {
  const entry = join(repoDir, "src", "index.ts");
  return existsSync(entry) ? readFileSync(entry, "utf8") : null;
}

/** 仓根 `.gitignore` 里还缺哪几条——**不替别人改文件**，只报出来 */
export function missingGitignore(repoDir: string): string[] {
  const file = join(repoDir, ".gitignore");
  const text = existsSync(file) ? readFileSync(file, "utf8") : "";
  return GITIGNORE_LINES.filter((line) => !text.includes(line));
}

/** 仓根已经有哪几个会被 outputs 摆放覆盖的文件——同样只报出来，让人先把内容搬进正本 */
export function existingPlaced(repoDir: string): string[] {
  return PLACED_FILES.filter((name) => existsSync(join(repoDir, name)));
}

/** 渲染好的一套落到 `<target>/…`，回写了哪些（相对仓根） */
export function writeFiles(target: string, files: TemplateFile[]): string[] {
  const written: string[] = [];
  for (const file of files) {
    const full = join(target, file.rel);
    mkdirSync(dirname(full), { recursive: true });
    writeFileSync(full, file.text, "utf8");
    written.push(`docs-site/${file.rel}`);
  }
  return written;
}
