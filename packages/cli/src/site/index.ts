/**
 * 建站：往一个**已经存在的仓**里铺一个六区 fumadocs 文档站，站接好 livedoc。
 *
 * 这个模块**自成一路**，跟这个包里别的东西（check / confirm / render 那三条）没有任何往来：
 * 那三条是「对一个已有的站做事」，建站是「造一个站」，它连 `livedoc.config.mjs` 都不读——
 * 那正是它要铺出来的东西。只 import `node:fs` / `node:path` / `node:url`，核心三包一个不认识。
 *
 * **面上只有两个方法**：`planSite` 算一套（不碰盘）、`createSite` 算完直接铺。调用方不必知道
 * 模板放在哪、占位符叫什么、端口怎么挑——那些是模块内部的 `template` / `ports` / `values` / `repo`。
 *
 * 六区：`content/{docs,trajectory,spec,future,outputs,feedback}`——现状、轨迹、交接、未来、
 * 生成正本、反馈，六个集合、六条路由、侧栏一棵树六个根节，每区一两页骨架，页头一句「本页回答」。
 * `livedoc.config.mjs` 预置 docs + outputs 两区进 check、trajectory 指卡目录、agents / readme 两条
 * 摆放映射——所以铺完的站要先 `pnpm doc:render` 摆出仓根 AGENTS.md / README.md，check 才绿。
 *
 * 前置条件跟建仓脚本正好相反——建新仓要求目标目录还不存在，加站要求仓已经在、
 * 而 `<仓>/docs-site` 还不在。只铺文件：**不跑 `pnpm install`**（替人装依赖，出错时现场
 * 在哪都不好找），**不改仓里任何已有文件**（`.gitignore` 缺哪几条只报出来；仓根已有
 * README.md / AGENTS.md 的只报一声——第一次 render 会覆盖它们，内容得先搬进 outputs 区的正本）。
 *
 * 整套先在内存渲染完再碰盘：占位符认不出是最可能的失败，而目录一旦开始写就没有干净的回滚点。
 * `planSite` 就是把这个中间态直接交出去——**它是接口的一部分，不是实现细节**：想先看看会铺出
 * 什么、会占哪个口的调用方，不必先弄脏一个目录再回滚。
 *
 * **模板假设的仓形状**：站住仓根下的 `docs-site/`，被钉的代码在仓根（引用写 `../src/…`）。
 * 换一种形状（站叫别的名字、代码在 `packages/` 下），`livedoc.config.mjs` 里的相对路径
 * 就得跟着改——那是模板的前提，不是可有可无的巧合。
 *
 * 这个模块只认「一个仓 + 一份模板」，不认识任何生态：它不知道调它的人在写什么件、
 * 也不知道仓的邻居是谁。**别人依赖它，它不依赖别人。**
 */
import { existsSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { pickPort, scanUsedPorts } from "./ports.ts";
import { existingPlaced, missingGitignore, readEntry, readManifest, writeFiles } from "./repo.ts";
import { readTemplate, renderSite, SITE_TEMPLATE, type SiteValues, type TemplateFile } from "./template.ts";
import { namesFor, pinBlockFrom } from "./values.ts";

export type { TemplateFile } from "./template.ts";
export { PORT_FROM, PORT_TO } from "./ports.ts";

/** 铺一个站要的全部输入。除了 `repoDir` 都可以不给 */
export interface SiteOptions {
  /** 往哪个仓里铺。要已经存在，且它下面还没有 `docs-site/` */
  repoDir: string;
  /** 站的显示名，不给就从仓根 package.json 认，再退回目录名 */
  title?: string;
  /** 指定端口。给了就一定是它——被邻居占着也让给你，只在 `used` 里看得出来 */
  port?: number;
  /** 端口往哪儿扫，缺省是仓的父目录（同级各仓）。给了就按给的扫 */
  neighborhood?: string;
  /** 模板从哪儿读，缺省是包里带的那份 */
  template?: string;
}

/** 算完但还没碰盘的一套站 */
export interface SitePlan {
  /** 站要铺在哪（`<仓>/docs-site` 的绝对路径） */
  target: string;
  /** 这个站用哪个口 */
  port: number;
  /** 邻居已经占掉的口 → 占它的那个目录。手给的口撞上了也在这儿看得出来 */
  used: Map<number, string>;
  /** 渲染好的整套，`rel` 相对站目录、`.tpl` 后缀已经脱掉 */
  files: TemplateFile[];
  /** 仓根 `.gitignore` 里还缺的那几条（本模块不替人加） */
  missingGitignore: string[];
  /** 仓根已有、第一次 render 会被覆盖的生成物（README.md / AGENTS.md） */
  overwrites: string[];
}

/** 铺完的结果：那份计划，外加真落了盘的文件清单 */
export interface SiteResult extends SitePlan {
  /** 落了哪些文件，相对仓根 */
  written: string[];
}

/**
 * 算一套站出来，**一个字都不写盘**：校验仓 → 认名字 → 挑端口 → 整套渲染进内存。
 * 校验不过（仓不在、不是目录、站已经在）与占位符认不出都在这一步抛。
 */
export function planSite(options: SiteOptions): SitePlan {
  const repoDir = resolve(options.repoDir);
  if (!existsSync(repoDir)) throw new Error(`仓不在：${repoDir}（建站是往已有仓里加站的，先把仓建出来）`);
  if (!statSync(repoDir).isDirectory()) throw new Error(`不是目录：${repoDir}`);
  const target = join(repoDir, "docs-site");
  if (existsSync(target)) throw new Error(`这个仓已经有站了，不覆盖任何东西：${target}`);

  const used = scanUsedPorts(options.neighborhood ?? dirname(repoDir));
  const port = pickPort(used, options.port);
  const values: SiteValues = {
    ...namesFor(repoDir, readManifest(repoDir), options.title),
    port: String(port),
    pinBlock: pinBlockFrom(readEntry(repoDir)),
  };

  return {
    target,
    port,
    used,
    files: renderSite(readTemplate(options.template ?? SITE_TEMPLATE), values),
    missingGitignore: missingGitignore(repoDir),
    overwrites: existingPlaced(repoDir),
  };
}

/**
 * 铺一个站：先 `planSite` 算全套，再把渲好的文件落盘。落盘那一步只剩写文件——
 * 会抛的都在算的那一半抛完了。
 */
export function createSite(options: SiteOptions): SiteResult {
  const plan = planSite(options);
  return { ...plan, written: writeFiles(plan.target, plan.files) };
}
