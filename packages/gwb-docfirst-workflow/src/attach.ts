/**
 * 装配：在已经生成的 fumadocs 骨架上加 docfirst 的集合、路由、侧栏、配置、组件与骨架页，
 * 并往站的 `package.json` 里补依赖与脚本。
 *
 * 骨架由站点插件（`@godcreator/gwb-docs-site` 的 `docs-site.create`）生成，本模块不生成骨架。
 * 本模块只 import `node:fs` / `node:path` / `node:url`，不依赖 `@godcreator/docfirst-workflow`，
 * 也不读 docfirst 配置（配置正是它要写出来的文件）。
 *
 * 对外两个函数：`planAttach` 只计算不写盘，`attachSite` 计算后写盘。
 * 所有能失败的检查（骨架检查、占位符、写盘前的路径检查）都在写第一个文件之前做完；
 * 写盘途中仍然失败时，已写的文件恢复原样、新建的文件与目录删掉，再把错误抛出。
 *
 * 模板假设站在仓根下一层（约定叫 `docs-site/`）：outputs 映射把 README / AGENTS / CLAUDE 生成到 `../`。
 */
import { existsSync, mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { withDocfirst } from "./manifest.js";
import { inspectSite, readRepoManifest, type SiteFacts } from "./skeleton.js";
import { readTemplate, renderSite, ATTACH_TEMPLATE, type SiteValues, type TemplateFile } from "./template.js";
import { valuesFor } from "./values.js";

export type { TemplateFile } from "./template.js";
export { DOC_SCRIPTS } from "./manifest.js";
export { DOCFIRST_DEPS } from "./deps.js";
export { DEFAULT_PORT, SUPERSEDED } from "./skeleton.js";

/** 装配的输入。除了 `siteDir` 都可以不给 */
export interface AttachOptions {
  /** 目标站目录：已经存在、是 fumadocs 骨架、还没装过 docfirst */
  siteDir: string;
  /** 站的显示名，不给就从仓根 package.json 认，再用仓的目录名 */
  title?: string;
  /** 模板目录，缺省是包里带的那份 */
  template?: string;
}

/** 计算好、还没写盘的一次装配 */
export interface AttachPlan {
  /** 站目录的绝对路径 */
  target: string;
  /** 站所在的仓 */
  repoDir: string;
  /** 骨架用的端口，装配不改它 */
  port: number;
  /** 要写的全部文件，`rel` 相对站目录、`.tpl` 后缀已去掉 */
  files: TemplateFile[];
  /** 合并后的 `package.json` 正文（也在 `files` 里） */
  manifest: string;
  /** `files` 里站上已经存在、会被覆盖的文件（相对站目录） */
  replaced: string[];
  /** 装配会删掉的骨架文件（相对站目录） */
  superseded: string[];
  /** 仓根已有、第一次 render 会覆盖的生成物 */
  overwrites: string[];
}

/** 装配结果：计划本身，加上实际写了哪些文件 */
export interface AttachResult extends AttachPlan {
  /** 写了哪些文件，相对站目录 */
  written: string[];
}

/**
 * 计算一次装配，不写盘：检查骨架 → 认名字 → 在内存里渲染整套模板 → 合并 package.json →
 * 检查每个要写的路径都写得下去。任何一步不通过都在这里抛出。
 */
export function planAttach(options: AttachOptions): AttachPlan {
  const siteDir = resolve(options.siteDir);
  const facts: SiteFacts = inspectSite(siteDir);
  const values: SiteValues = valuesFor(siteDir, facts.repoDir, readRepoManifest(facts.repoDir), options.title);
  const manifest = withDocfirst(facts.manifestText, values.title);
  const files = [...renderSite(readTemplate(options.template ?? ATTACH_TEMPLATE), values), { rel: "package.json", text: manifest }];
  assertWritable(siteDir, files.map((file) => file.rel));
  return {
    target: siteDir,
    repoDir: facts.repoDir,
    port: facts.port,
    files,
    manifest,
    replaced: files.map((file) => file.rel).filter((rel) => existsSync(join(siteDir, rel))),
    superseded: facts.superseded,
    overwrites: facts.overwrites,
  };
}

/** 计算一次装配并写盘。写盘途中失败时站恢复到写之前的样子 */
export function attachSite(options: AttachOptions): AttachResult {
  const plan = planAttach(options);
  applyPlan(plan.target, plan.files, plan.superseded);
  return { ...plan, written: plan.files.map((file) => file.rel) };
}

/**
 * 每个要写的文件：自己不能是已存在的目录，站目录以下的上级路径里不能有已存在的普通文件。
 * 有问题的路径一次全部列出。
 */
function assertWritable(target: string, rels: readonly string[]): void {
  const blocked = new Set<string>();
  for (const rel of rels) {
    const parts = rel.split("/");
    if (isDirectory(join(target, ...parts))) blocked.add(`${rel}（已经是目录）`);
    for (let depth = 1; depth < parts.length; depth++) {
      const ancestor = parts.slice(0, depth).join("/");
      const full = join(target, ...parts.slice(0, depth));
      if (existsSync(full) && !statSync(full).isDirectory()) blocked.add(`${ancestor}（是文件，${rel} 要把它当目录）`);
    }
  }
  if (blocked.size > 0) throw new Error(`这些路径写不下去，一个文件都没写：${[...blocked].join("、")}`);
}

function isDirectory(full: string): boolean {
  return existsSync(full) && statSync(full).isDirectory();
}

/** 写盘前的一个文件：原来的内容，不存在是 null */
interface Snapshot {
  full: string;
  before: Buffer | null;
}

/** 写文件、删文件；任何一步失败就撤销已做的改动再抛出 */
function applyPlan(target: string, files: readonly TemplateFile[], removals: readonly string[]): void {
  const touched: Snapshot[] = [];
  const createdDirs: string[] = [];
  const snapshot = (full: string): void => {
    touched.push({ full, before: existsSync(full) ? readFileSync(full) : null });
  };
  try {
    for (const file of files) {
      const full = join(target, ...file.rel.split("/"));
      const created = mkdirSync(dirname(full), { recursive: true });
      if (created !== undefined) createdDirs.push(created);
      snapshot(full);
      writeFileSync(full, file.text, "utf8");
    }
    for (const rel of removals) {
      const full = join(target, ...rel.split("/"));
      snapshot(full);
      rmSync(full, { force: true });
    }
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    try {
      rollback(touched, createdDirs);
    } catch (rollbackError) {
      const why = rollbackError instanceof Error ? rollbackError.message : String(rollbackError);
      throw new Error(`写盘途中失败（${reason}），恢复原样时又失败（${why}）：${target} 现在是改了一半的状态，要人工检查`, { cause: error });
    }
    throw new Error(`写盘途中失败，站已恢复原样：${reason}`, { cause: error });
  }
}

/** 按相反顺序恢复：原来有的写回原内容（内容没变的不写），原来没有的删掉，新建的目录删掉 */
function rollback(touched: readonly Snapshot[], createdDirs: readonly string[]): void {
  for (const { full, before } of [...touched].reverse()) {
    if (before === null) {
      rmSync(full, { force: true });
      continue;
    }
    if (existsSync(full) && readFileSync(full).equals(before)) continue;
    writeFileSync(full, before);
  }
  for (const dir of [...createdDirs].reverse()) rmSync(dir, { recursive: true, force: true });
}
