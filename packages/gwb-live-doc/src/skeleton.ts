/**
 * 目标站这一头的事实：它是不是一个**刚铺好的 fumadocs 骨架**、它用哪个口、它的仓叫什么、
 * 仓根哪几个文件会被第一次 render 覆盖。
 *
 * 模块内部件，不在装配接口的面上。这一层的纪律有两条：**只读**（会覆盖什么只报出来），
 * 与**宁可拒绝也不改写**——`assertFresh` 是整个装配唯一的门，它放行之后下游一路覆盖。
 */
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

/** fumadocs 家的三个包名。依赖里有任一就算 fumadocs 站 */
const FUMADOCS_PACKAGES = ["fumadocs-core", "fumadocs-mdx", "fumadocs-ui"];

/**
 * 刚铺好的骨架里，`content/` 下允许有的东西（相对 `content/` 的 posix 路径）。
 * 多出一个就是有人写过内容了——那时装配一律拒。
 */
const SKELETON_CONTENT = new Set(["docs", "docs/index.mdx", "docs/meta.json"]);

/** 骨架自己的那份文档布局。六区的侧栏抬到根 layout，这一份要让位——装配把它删掉 */
export const SUPERSEDED = ["src/app/docs/layout.tsx"];

/** 模板的 outputs 映射会往仓根摆的生成物：仓里已经有的，第一次 render 就会被覆盖 */
const PLACED_FILES = ["README.md", "AGENTS.md"];

/** `next dev -p <口>` / `next start -p <口>` 认不出来时退回 next 自己的默认口 */
export const DEFAULT_PORT = 3000;

/** 目标站的 package.json 里本模块读得动的那几样 */
export interface SiteManifest {
  name?: unknown;
  description?: unknown;
  scripts?: Record<string, unknown>;
}

/** 装配前把目标站看一遍，看出来的全部事实 */
export interface SiteFacts {
  /** 站目录的绝对路径 */
  dir: string;
  /** 站所在的仓（站目录的上一级）——被钉的代码在那儿，引用写 `../src/…` */
  repoDir: string;
  /** 站自己的 package.json 原文，装配那一步要往里合并 */
  manifestText: string;
  /** 骨架挑的那个口，从 scripts 里认；认不出退 `DEFAULT_PORT` */
  port: number;
  /** 仓根已有、第一次 render 会被覆盖的生成物 */
  overwrites: string[];
  /** 骨架里要让位、装配会删掉的文件（相对站目录） */
  superseded: string[];
}

/** 一份 package.json 是不是 fumadocs 站：dependencies 与 devDependencies 里有 fumadocs 家的包 */
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

/** 骨架挑的那个口：按 `next dev -p <口>` / `next start -p <口>` 认，认不出退默认 */
export function portOf(manifest: SiteManifest): number {
  for (const command of Object.values(manifest.scripts ?? {})) {
    if (typeof command !== "string") continue;
    const hit = /\bnext\s+(?:dev|start)\b[^&|]*?-p\s+(\d{2,5})/.exec(command);
    if (hit !== null) return Number(hit[1]);
  }
  return DEFAULT_PORT;
}

/** `content/` 下有骨架之外的东西吗——有就把它们列出来（相对 `content/` 的 posix 路径，排过序） */
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

/**
 * 装配唯一的那道门。**只在刚铺好的骨架上跑**——放行之后整套覆盖是安全的，因为中间没人
 * 改过文件；给一个跑了半年的站加 livedoc，报一句让人工接线，比自作聪明地 AST 改写安全。
 *
 * 四条拒的理由各说各的：目录不对、不是 fumadocs 骨架、已经接过 livedoc、`content/` 下已有内容。
 */
export function inspectSite(siteDir: string): SiteFacts {
  if (!existsSync(siteDir)) throw new Error(`站不在：${siteDir}（装配是往一个已经铺好的 fumadocs 骨架上加六区，先把骨架铺出来）`);
  if (!statSync(siteDir).isDirectory()) throw new Error(`不是目录：${siteDir}`);

  const manifestPath = join(siteDir, "package.json");
  if (!existsSync(manifestPath)) throw new Error(`不是 fumadocs 骨架：${siteDir} 下没有 package.json`);
  const manifestText = readFileSync(manifestPath, "utf8");
  if (!isFumadocsSite(manifestText)) {
    throw new Error(`不是 fumadocs 骨架：${siteDir} 的依赖里没有 fumadocs-core / -mdx / -ui`);
  }

  if (existsSync(join(siteDir, "livedoc.config.mjs"))) {
    throw new Error(`这个站已有内容，请人工接线：${siteDir} 下已经有 livedoc.config.mjs`);
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

/** 仓根 package.json 里能认出来的那两样。读不动不挡事——名字退回目录名 */
export function readRepoManifest(repoDir: string): { name?: unknown; title?: unknown } | null {
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
