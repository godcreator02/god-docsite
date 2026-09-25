/**
 * 目标站的事实：它是不是一个刚生成、还没装过 docfirst 的 fumadocs 骨架，用哪个端口，仓在哪，
 * 仓根哪几个文件会被第一次 render 覆盖。
 *
 * 这一层只读不写。`inspectSite` 拒绝的站，装配一个文件都不写。
 */
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

/** fumadocs 的三个包名。依赖里有任一个就算 fumadocs 站 */
const FUMADOCS_PACKAGES = ["fumadocs-core", "fumadocs-mdx", "fumadocs-ui"];

/**
 * 刚生成的骨架里 `content/` 下允许有的路径（相对 `content/`，正斜杠）。
 * 多出任何一个就是有人写过内容，装配拒绝。
 */
const SKELETON_CONTENT = new Set(["docs", "docs/index.mdx", "docs/meta.json"]);

/** 骨架自带的文档布局。装配把侧栏放到根 layout 上，这一份要删掉，否则两层 DocsLayout 叠在一起、侧栏出现两遍 */
export const SUPERSEDED = ["src/app/docs/layout.tsx"];

/** 模板的 outputs 映射会写到仓根的生成物：仓里已经有的，第一次 render 就会被覆盖 */
const PLACED_FILES = ["README.md", "AGENTS.md", "CLAUDE.md"];

/** docfirst 配置文件名：扩展名不限，出现任何一个就说明这个站已经装过 */
const DOCFIRST_CONFIG = /^docfirst\.config\.[^.]+$/;

/** `next dev -p <端口>` / `next start -p <端口>` 认不出来时用 next 自己的默认端口 */
export const DEFAULT_PORT = 3000;

/** 目标站 package.json 里本模块用到的字段 */
export interface SiteManifest {
  name?: unknown;
  description?: unknown;
  scripts?: Record<string, unknown>;
}

/** 装配前检查目标站得到的全部事实 */
export interface SiteFacts {
  /** 站目录的绝对路径 */
  dir: string;
  /** 站所在的仓（站目录的上一级），被引用的代码在那里，引用写 `../src/…` */
  repoDir: string;
  /** 站自己的 package.json 原文，装配要往里合并 */
  manifestText: string;
  /** 骨架用的端口，从 scripts 里认；认不出是 `DEFAULT_PORT` */
  port: number;
  /** 仓根已有、第一次 render 会被覆盖的生成物 */
  overwrites: string[];
  /** 骨架里要删掉的文件（相对站目录） */
  superseded: string[];
}

/** 一份 package.json 是不是 fumadocs 站：dependencies 或 devDependencies 里有 fumadocs 的包 */
export function isFumadocsSite(manifestText: string): boolean {
  let parsed: unknown;
  try {
    parsed = JSON.parse(manifestText);
  } catch {
    return false;
  }
  if (typeof parsed !== "object" || parsed === null) return false;
  const pkg = parsed as { dependencies?: Record<string, unknown>; devDependencies?: Record<string, unknown> };
  const names = [...Object.keys(pkg.dependencies ?? {}), ...Object.keys(pkg.devDependencies ?? {})];
  return names.some((name) => FUMADOCS_PACKAGES.includes(name));
}

/** 骨架用的端口：按 `next dev -p <端口>` / `next start -p <端口>` 认，认不出用默认端口 */
export function portOf(manifest: SiteManifest): number {
  for (const command of Object.values(manifest.scripts ?? {})) {
    if (typeof command !== "string") continue;
    const hit = /\bnext\s+(?:dev|start)\b[^&|]*?-p\s+(\d{2,5})/.exec(command);
    if (hit !== null) return Number(hit[1]);
  }
  return DEFAULT_PORT;
}

/** `content/` 下骨架之外的路径（相对 `content/`，正斜杠，排过序） */
export function extraContent(siteDir: string): string[] {
  const root = join(siteDir, "content");
  if (!existsSync(root)) return [];
  const extra: string[] = [];
  const walk = (prefix: string): void => {
    for (const entry of readdirSync(join(root, prefix), { withFileTypes: true })) {
      const rel = prefix === "" ? entry.name : `${prefix}/${entry.name}`;
      if (!SKELETON_CONTENT.has(rel)) {
        extra.push(rel);
        continue;
      }
      if (entry.isDirectory()) walk(rel);
    }
  };
  walk("");
  return extra.sort();
}

/** 站目录下的 docfirst 配置文件名（排过序） */
export function docfirstConfigs(siteDir: string): string[] {
  return readdirSync(siteDir)
    .filter((name) => DOCFIRST_CONFIG.test(name))
    .sort();
}

/**
 * 检查目标站能不能装。拒绝的理由各报各的：目录不在、不是目录、不是 fumadocs 骨架、
 * 已经有 docfirst 配置、`content/` 下有骨架之外的内容。
 */
export function inspectSite(siteDir: string): SiteFacts {
  if (!existsSync(siteDir)) throw new Error(`站不在：${siteDir}（装配要在已经生成的 fumadocs 骨架上进行，先用 docs-site.create 生成骨架）`);
  if (!statSync(siteDir).isDirectory()) throw new Error(`不是目录：${siteDir}`);

  const manifestPath = join(siteDir, "package.json");
  if (!existsSync(manifestPath)) throw new Error(`不是 fumadocs 骨架：${siteDir} 下没有 package.json`);
  const manifestText = readFileSync(manifestPath, "utf8");
  if (!isFumadocsSite(manifestText)) {
    throw new Error(`不是 fumadocs 骨架：${siteDir} 的依赖里没有 fumadocs-core / -mdx / -ui`);
  }

  const configs = docfirstConfigs(siteDir);
  if (configs.length > 0) {
    throw new Error(`这个站已有内容，请人工接线：${siteDir} 下已经有 ${configs.join("、")}`);
  }
  const extra = extraContent(siteDir);
  if (extra.length > 0) {
    throw new Error(`这个站已有内容，请人工接线：content/ 下有骨架之外的 ${extra.join("、")}`);
  }

  const repoDir = join(siteDir, "..");
  return {
    dir: siteDir,
    repoDir,
    manifestText,
    port: portOf(JSON.parse(manifestText) as SiteManifest),
    overwrites: PLACED_FILES.filter((name) => existsSync(join(repoDir, name))),
    superseded: SUPERSEDED.filter((rel) => existsSync(join(siteDir, ...rel.split("/")))),
  };
}

/** 仓根 package.json 里的 name 与 title。文件不在或解析不了是 null，名字改用目录名 */
export function readRepoManifest(repoDir: string): { name?: unknown; title?: unknown } | null {
  const manifestPath = join(repoDir, "package.json");
  if (!existsSync(manifestPath)) return null;
  try {
    return JSON.parse(readFileSync(manifestPath, "utf8")) as { name?: unknown; title?: unknown };
  } catch {
    return null;
  }
}
