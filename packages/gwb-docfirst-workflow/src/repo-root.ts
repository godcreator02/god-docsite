/**
 * 站所在的仓根：显示名要读的 package.json，以及第一次 render 会覆盖的已有文件。只读不写。
 */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

/** 仓根 package.json 里显示名要用到的两个字段 */
export interface RepoManifest {
  name?: unknown;
  title?: unknown;
}

/** 模板的 outputs 映射会写到仓根的生成物：仓里已经有的，第一次 render 就会被覆盖 */
const RENDERED_INTO_REPO_ROOT = ["README.md", "AGENTS.md", "CLAUDE.md"];

/** 仓根 package.json；没有这个文件是 null（显示名改用目录名），有但解析不了就报错 */
export function readRepoManifest(repoDir: string): RepoManifest | null {
  const manifestPath = join(repoDir, "package.json");
  if (!existsSync(manifestPath)) return null;
  const text = readFileSync(manifestPath, "utf8");
  try {
    return JSON.parse(text) as RepoManifest;
  } catch (error) {
    throw new Error(`仓根的 package.json 不是合法的 JSON：${manifestPath}（${error instanceof Error ? error.message : String(error)}）`, { cause: error });
  }
}

/** 仓根已有、第一次 render 会被覆盖的文件名 */
export function filesFirstRenderOverwrites(repoDir: string): string[] {
  return RENDERED_INTO_REPO_ROOT.filter((name) => existsSync(join(repoDir, name)));
}
