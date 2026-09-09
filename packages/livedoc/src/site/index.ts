/**
 * 装配：在一个**已经铺好的 fumadocs 骨架**上加 livedoc 的六区。
 *
 * 建骨架不在这儿——那是「谁装了 fumadocs 谁就该有」的能力，归站件
 * （`@godcreator02/gwb-docs-site` 的 `docs-site.create`）。本模块接手的是骨架之后的那一层：
 * 六个集合、六条路由、侧栏六个根节、`livedoc.config.mjs`、mdx 接线、投影块与术语组件、
 * 名册脚本、构建配置里那条不许外置的账、五个区的骨架页，外加往 `package.json` 里补依赖与脚本。
 *
 * 这个模块**自成一路**，跟这个包里别的东西（check / confirm / render 那三条）没有任何往来：
 * 那三条是「对一个已经接好的站做事」，装配是「把线接上」，它连 `livedoc.config.mjs` 都不读——
 * 那正是它要写出来的东西。只 import `node:fs` / `node:path` / `node:url`，判定与环境两层一个不认识。
 *
 * **面上只有两个方法**：`planAttach` 算一套（不碰盘）、`attachSite` 算完直接落。调用方不必知道
 * 模板放在哪、占位符叫什么、package.json 怎么合——那些是模块内部的 `template` / `skeleton` /
 * `manifest` / `values`。
 *
 * **只在刚铺好的骨架上跑**：站里已经有 `livedoc.config.mjs`、或 `content/` 下已经有骨架之外的
 * 内容，`inspectSite` 当场抛「这个站已有内容，请人工接线」，一个字不改写。放行之后整套覆盖是
 * 安全的——中间没人改过文件。给一个跑了半年的站加 livedoc 走人工那条路，比 AST 改写安全。
 *
 * 整套先在内存渲染完再碰盘：占位符认不出是最可能的失败，而目录一旦开始写就没有干净的回滚点。
 * `planAttach` 就是把这个中间态直接交出去——**它是接口的一部分，不是实现细节**。
 *
 * **模板假设的仓形状**：站住仓根下一层（约定叫 `docs-site/`），被钉的代码在仓根（引用写
 * `../src/…`）。换一种形状，`livedoc.config.mjs` 里的相对路径就得跟着改——那是模板的前提。
 *
 * 这个模块只认「一个骨架 + 一份模板」，不认识任何生态：它不知道调它的人在写什么件、
 * 骨架是谁铺的。**别人依赖它，它不依赖别人。**
 */
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { withLivedoc } from "./manifest.ts";
import { inspectSite, readEntry, readRepoManifest, type SiteFacts } from "./skeleton.ts";
import { readTemplate, renderSite, ATTACH_TEMPLATE, type SiteValues, type TemplateFile } from "./template.ts";
import { namesFor, pinBlockFrom } from "./values.ts";

export type { TemplateFile } from "./template.ts";
export { DOC_SCRIPTS } from "./manifest.ts";
export { LIVEDOC_DEPS } from "./deps.ts";
export { DEFAULT_PORT, SUPERSEDED } from "./skeleton.ts";

/** 装一次要的全部输入。除了 `siteDir` 都可以不给 */
export interface AttachOptions {
  /** 往哪个站上装。要已经存在、是个 fumadocs 骨架、还没接过 livedoc */
  siteDir: string;
  /** 站的显示名，不给就从仓根 package.json 认，再退回仓的目录名 */
  title?: string;
  /** 模板从哪儿读，缺省是包里带的那份 */
  template?: string;
}

/** 算完但还没碰盘的一套装配 */
export interface AttachPlan {
  /** 装在哪（站目录的绝对路径） */
  target: string;
  /** 站所在的仓（被钉的代码在那儿） */
  repoDir: string;
  /** 骨架挑的那个口，只是报出来——装配不改它 */
  port: number;
  /** 渲染好的整套，`rel` 相对站目录、`.tpl` 后缀已经脱掉 */
  files: TemplateFile[];
  /** 合并完的 `package.json` 正文（也在 `files` 里，单独拎出来给调用方看） */
  manifest: string;
  /** 骨架里要让位、装配会删掉的文件（相对站目录） */
  superseded: string[];
  /** 仓根已有、第一次 render 会被覆盖的生成物（README.md / AGENTS.md） */
  overwrites: string[];
}

/** 装完的结果：那份计划，外加真落了盘的文件清单 */
export interface AttachResult extends AttachPlan {
  /** 写了哪些文件，相对站目录 */
  written: string[];
}

/**
 * 算一套装配出来，**一个字都不写盘**：验骨架 → 认名字 → 整套渲染进内存 → 合 package.json。
 * 骨架不合规（不在、不是 fumadocs、已经接过线、content 下有内容）与占位符认不出都在这一步抛。
 */
export function planAttach(options: AttachOptions): AttachPlan {
  const siteDir = resolve(options.siteDir);
  const facts: SiteFacts = inspectSite(siteDir);
  const names = namesFor(facts.repoDir, readRepoManifest(facts.repoDir), options.title);
  const values: SiteValues = {
    ...names,
    port: String(facts.port),
    pinBlock: pinBlockFrom(readEntry(facts.repoDir)),
  };

  const files = renderSite(readTemplate(options.template ?? ATTACH_TEMPLATE), values);
  const manifest = withLivedoc(facts.manifestText, names.title);
  return {
    target: siteDir,
    repoDir: facts.repoDir,
    port: facts.port,
    files: [...files, { rel: "package.json", text: manifest }],
    manifest,
    superseded: facts.superseded,
    overwrites: facts.overwrites,
  };
}

/**
 * 装一次：先 `planAttach` 算全套，再把渲好的文件落盘、把让位的那几个删掉。
 * 落盘那一步只剩写文件——会抛的都在算的那一半抛完了。
 */
export function attachSite(options: AttachOptions): AttachResult {
  const plan = planAttach(options);
  const written = writeFiles(plan.target, plan.files);
  // 让位：骨架的 src/app/docs/layout.tsx 那份 DocsLayout 已经抬到根 layout 上，
  // 留着就是两层 DocsLayout 套着渲——侧栏出现两遍，谁也看不出是哪儿来的
  for (const rel of plan.superseded) rmSync(join(plan.target, ...rel.split("/")), { force: true });
  return { ...plan, written };
}

/** 渲染好的一套落到站目录下，回写了哪些（相对站目录） */
function writeFiles(target: string, files: readonly TemplateFile[]): string[] {
  const written: string[] = [];
  for (const file of files) {
    const full = join(target, file.rel);
    mkdirSync(dirname(full), { recursive: true });
    writeFileSync(full, file.text, "utf8");
    written.push(file.rel);
  }
  return written;
}
