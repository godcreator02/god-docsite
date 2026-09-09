/**
 * `livedoc init`：往一个**已经存在的仓**里铺一个六区 fumadocs 文档站，站接好 livedoc。
 *
 * 六区：`content/{docs,trajectory,spec,future,outputs,feedback}`——现状、轨迹、交接、未来、
 * 生成正本、反馈，六个集合、六条路由、侧栏一棵树六个根节，每区一两页骨架，页头一句「本页回答」。
 * `livedoc.config.mjs` 预置 docs + outputs 两区进 check、trajectory 指卡目录、agents / readme 两条
 * 摆放映射——所以铺完的站要先 `pnpm doc:render` 摆出仓根 AGENTS.md / README.md，check 才绿。
 *
 * 前置条件跟建仓脚本正好相反——建新仓要求目标目录还不存在，加站要求仓已经在、
 * 而 `<仓>/docs-site` 还不在。只铺文件：**不跑 `pnpm install`**（替人装依赖，出错时现场
 * 在哪都不好找），**不改仓里任何已有文件**（`.gitignore` 缺哪几条只打印出来；仓根已有
 * README.md / AGENTS.md 的只警告——第一次 render 会覆盖它们，内容得先搬进 outputs 区的正本）。
 *
 * 整套先在内存渲染完再碰盘：占位符认不出是最可能的失败，而目录一旦开始写就没有干净的回滚点。
 *
 * **模板假设的仓形状**：站住仓根下的 `docs-site/`，被钉的代码在仓根（引用写 `../src/…`）。
 * 换一种形状（站叫别的名字、代码在 `packages/` 下），`livedoc.config.mjs` 里的相对路径
 * 就得跟着改——那是模板的前提，不是可有可无的巧合。
 *
 * 这个模块只认「一个仓 + 一份模板」，不认识任何生态：它不知道调它的人在写什么件、
 * 也不知道仓的邻居是谁。**别人依赖它，它不依赖别人。**
 */
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * 站模板的位置。源码态是 `packages/cli/src/init.ts`、产物态是 `packages/cli/dist/*.mjs`，
 * 两态都在包根下一层，所以 `../template/docs-site` 两态都指得对。
 */
export const SITE_TEMPLATE = fileURLToPath(new URL("../template/docs-site", import.meta.url));

/** 模板文件的后缀，落盘时脱掉——带着它躺在包里，才不会被别的工具当成真配置去解析 */
const SUFFIX = ".tpl";

/** 端口从这一段起找。4310–4399 是留给文档站的一段 */
const PORT_FROM = 4310;
const PORT_TO = 4399;

/** 站的产物要忽略掉的那几条 */
export const GITIGNORE_LINES = ["docs-site/.next/", "docs-site/.source/", "docs-site/out/"];

/** 模板的 outputs 映射会往仓根摆的生成物：仓里已经有的，第一次 render 就会被覆盖 */
export const PLACED_FILES = ["README.md", "AGENTS.md"];

/** 一个待落盘的文件：相对站目录的路径（正斜杠）加正文 */
export interface TemplateFile {
  rel: string;
  text: string;
}

/** 模板里的占位符集合。认不出的占位符当场抛，见 renderText */
export interface SiteValues {
  /** 站自己的包名前缀（`<name>-docs-site`），得是合法的 npm 名字 */
  name: string;
  /** 站的显示名 */
  title: string;
  /** 被记录的仓的包名（`package.json` 的 name，取不到就退目录名） */
  pkg: string;
  /** 短名：包名去掉 scope 的那一截，正文里当称呼用 */
  pkgName: string;
  /** 站跑在哪个口 */
  port: string;
  /** 起手页里「第一条引用」那一块 */
  pinBlock: string;
}

/* ── 纯逻辑：扫端口、挑端口、渲染、pinBlock ───────────────────────────────── */

/**
 * 扫一遍**目标仓的邻居**已经占掉的站端口——同一个父目录下的各个仓，深三层。
 *
 * **按脚本内容认，不按目录名认**：站不一定叫 `docs-site`，认的是 package.json 的 scripts 里
 * 那个 `next dev -p <口>` / `next start -p <口>`。目录名靠不住，脚本靠得住。
 */
export function scanUsedPorts(neighborhood: string): Map<number, string> {
  const used = new Map<number, string>();
  if (!existsSync(neighborhood)) return used;

  const visit = (dir: string, depth: number): void => {
    if (depth > 3) return;
    let entries;
    try {
      entries = readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      if (entry.isDirectory()) {
        if (entry.name === "node_modules" || entry.name.startsWith(".")) continue;
        visit(join(dir, entry.name), depth + 1);
      } else if (entry.name === "package.json") {
        let json: { scripts?: Record<string, unknown> };
        try {
          json = JSON.parse(readFileSync(join(dir, entry.name), "utf8")) as { scripts?: Record<string, unknown> };
        } catch {
          continue;
        }
        for (const command of Object.values(json.scripts ?? {})) {
          if (typeof command !== "string") continue;
          const hit = /\bnext\s+(?:dev|start)\b[^&|]*?-p\s+(\d{2,5})/.exec(command);
          if (hit !== null) used.set(Number(hit[1]), dir);
        }
      }
    }
  };
  visit(neighborhood, 0);
  return used;
}

/**
 * 挑一个口。**手给的一律让给你**——被占了上层只警告一声，不替人改主意：
 * 人知道自己在干什么（比如那个占它的站早就不跑了）。没给就从 4310 起找第一个空位。
 */
export function pickPort(used: Iterable<number> | Map<number, string>, prefer?: number): number {
  if (prefer !== undefined) return prefer;
  const taken = used instanceof Map ? new Set(used.keys()) : new Set(used);
  for (let port = PORT_FROM; port <= PORT_TO; port += 1) {
    if (!taken.has(port)) return port;
  }
  throw new Error(`${PORT_FROM}–${PORT_TO} 全被占了，自己给一个 --port`);
}

/** 认不出的占位符当场抛——留一个 `{{typo}}` 在生成的站里，没人知道它本来该是什么 */
export function renderText(text: string, values: SiteValues, rel: string): string {
  return text.replace(/\{\{(\w+)\}\}/g, (_whole, key: string) => {
    if (!(key in values)) throw new Error(`模板里有认不出的占位符 {{${key}}}（${rel}）`);
    return values[key as keyof SiteValues];
  });
}

/** 整套模板在内存里渲染完：占位符错了这一步就抛，盘上一个字都还没写 */
export function renderSite(template: TemplateFile[], values: SiteValues): TemplateFile[] {
  return template.map((file) => ({
    rel: file.rel.endsWith(SUFFIX) ? file.rel.slice(0, -SUFFIX.length) : file.rel,
    text: renderText(file.text, values, file.rel),
  }));
}

/**
 * 起手页里那块「第一条引用」，按仓根 `src/index.ts` 的内容决定。
 *
 * 找得到 `export const name` 就钉那一行——**行号是现找的，不写死**。找不到（或者根本没有
 * 这个文件）就不钉，改成写一段「第一条引用怎么钉」：**硬塞一条钉不住的引用，等于开局
 * 就给读者一条红的。**
 */
export function pinBlockFrom(entrySource: string | null): string {
  if (entrySource !== null) {
    const lines = entrySource.split("\n");
    const at = lines.findIndex((line) => /^\s*export\s+const\s+name\s*=/.test(line));
    if (at >= 0) {
      const n = at + 1;
      return `下面这块不是抄进文档的副本，是构建那一刻从源码现拿的：

@@livedoc ref ../src/index.ts:${n}-${n} @@

上面那行是**草稿记号**。先落一个提交，再在这个目录跑 \`pnpm doc:confirm\`，它会被换成正式
记号、状态点转绿——git 比较器只对已提交、工作区干净的内容钉。`;
    }
  }
  // 样例记号写进围栏里：围栏内容是 code 节点，check 认不出草稿记号——**这一步不能省**，
  // 一条指着 `某个文件.ts` 的活记号会让刚铺好的站开局就报一条钉不住的引用。
  return `**这一页还没钉第一条引用。** 钉一条：在正文里单起一行写草稿记号（不是写在围栏里，
下面这块是样例），路径相对这个站目录——代码在仓根就写 \`../\`：

\`\`\`text
@@livedoc ref ../src/某个文件.ts:12-18 @@
\`\`\`

然后落一个提交、在这个目录跑 \`pnpm doc:confirm\`——草稿记号换成正式记号，状态点转绿。
git 比较器只对已提交、工作区干净的内容钉。`;
}

/** 名字：能从仓根 package.json 认出来就别让人再敲一遍。`--title` 给了就用给的 */
export function namesFor(
  repoDir: string,
  manifest: { name?: unknown; title?: unknown } | null,
  title?: string,
): Omit<SiteValues, "port" | "pinBlock"> {
  let pkg = typeof manifest?.name === "string" ? manifest.name : "";
  if (pkg === "") pkg = basename(repoDir);
  const pkgName = pkg.includes("/") ? pkg.slice(pkg.indexOf("/") + 1) : basename(repoDir);
  const given = (title ?? "").trim();
  const fromManifest = typeof manifest?.title === "string" ? manifest.title.trim() : "";
  return {
    name: slug(pkgName),
    title: given !== "" ? given : fromManifest !== "" ? fromManifest : pkgName,
    pkg,
    pkgName,
  };
}

/** 站自己的包名要合法：小写、只留字母数字和连字符 */
function slug(text: string): string {
  const out = text
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return out === "" ? "docs" : out;
}

/* ── 碰盘的那一半 ─────────────────────────────────────────────────────────── */

/** 递归读出模板下所有文件，回相对路径（正斜杠）加正文 */
export function readTemplate(root: string = SITE_TEMPLATE): TemplateFile[] {
  const walk = (prefix: string): TemplateFile[] => {
    const out: TemplateFile[] = [];
    for (const entry of readdirSync(join(root, prefix), { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
      const rel = prefix === "" ? entry.name : `${prefix}/${entry.name}`;
      if (entry.isDirectory()) out.push(...walk(rel));
      else out.push({ rel, text: readFileSync(join(root, rel), "utf8") });
    }
    return out;
  };
  return walk("");
}

/** 渲染好的一套落到 `<target>/…`，回写了哪些（相对仓根） */
export function writeSite(target: string, files: TemplateFile[]): string[] {
  const written: string[] = [];
  for (const file of files) {
    const full = join(target, file.rel);
    mkdirSync(dirname(full), { recursive: true });
    writeFileSync(full, file.text, "utf8");
    written.push(`docs-site/${file.rel}`);
  }
  return written;
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

export interface InitOptions {
  repoDir: string;
  title?: string;
  port?: number;
  /** 端口往哪儿扫，缺省是仓的父目录（同级各仓）。给了就按给的扫 */
  neighborhood?: string;
  /** 模板从哪儿读，缺省是包里带的那份 */
  template?: string;
}

export interface InitResult {
  target: string;
  port: number;
  used: Map<number, string>;
  written: string[];
  missing: string[];
  /** 仓根已有、第一次 render 会被覆盖的生成物（README.md / AGENTS.md） */
  overwrites: string[];
}

/**
 * 铺一个站。校验 → 认名字 → 挑端口 → 内存里渲染整套 → 落盘 → 报还缺哪几条 gitignore、
 * 仓根哪几个文件会被 render 覆盖。校验和渲染都在碰盘之前，落盘那一步只剩写文件。
 */
export function initSite(options: InitOptions): InitResult {
  const repoDir = resolve(options.repoDir);
  if (!existsSync(repoDir)) throw new Error(`仓不在：${repoDir}（init 是往已有仓里加站的，先把仓建出来）`);
  if (!statSync(repoDir).isDirectory()) throw new Error(`不是目录：${repoDir}`);
  const target = join(repoDir, "docs-site");
  if (existsSync(target)) throw new Error(`这个仓已经有站了，不覆盖任何东西：${target}`);

  let manifest: { name?: unknown; title?: unknown } | null = null;
  const manifestPath = join(repoDir, "package.json");
  if (existsSync(manifestPath)) {
    try {
      manifest = JSON.parse(readFileSync(manifestPath, "utf8")) as { name?: unknown };
    } catch {
      // package.json 读不动不挡事——名字退回目录名
    }
  }

  const used = scanUsedPorts(options.neighborhood ?? dirname(repoDir));
  const port = pickPort(used, options.port);

  const entry = join(repoDir, "src", "index.ts");
  const values: SiteValues = {
    ...namesFor(repoDir, manifest, options.title),
    port: String(port),
    pinBlock: pinBlockFrom(existsSync(entry) ? readFileSync(entry, "utf8") : null),
  };

  const rendered = renderSite(readTemplate(options.template ?? SITE_TEMPLATE), values);
  return {
    target,
    port,
    used,
    written: writeSite(target, rendered),
    missing: missingGitignore(repoDir),
    overwrites: existingPlaced(repoDir),
  };
}

/* ── 命令行那一层 ─────────────────────────────────────────────────────────── */

const HELP = `用法：livedoc init --dir <仓的绝对路径> [--title <显示名>] [--port <端口>]

  --dir    必给。**已经存在**的仓目录，且它下面还没有 docs-site/
  --title  站的显示名，缺省从仓根 package.json 的 name 里取，再退回目录名
  --port   缺省自动挑——扫一遍同级各仓已占的站端口，从 ${PORT_FROM} 起找第一个空位；
           手给的一律让给你，被占了只警告一声`;

function parseArgs(argv: string[]): Record<string, string | true> {
  const out: Record<string, string | true> = {};
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i]!;
    if (!token.startsWith("--")) continue;
    const key = token.slice(2);
    const next = argv[i + 1];
    if (next === undefined || next.startsWith("--")) out[key] = true;
    else {
      out[key] = next;
      i += 1;
    }
  }
  return out;
}

/** `livedoc init`：认参数、铺站、把接着做什么打出来。红了退 1，只要 help 退 0 */
export function initCommand(argv: string[]): number {
  const args = parseArgs(argv);
  if (args.help === true) {
    console.log(HELP);
    return 0;
  }
  if (typeof args.dir !== "string") {
    console.error(HELP);
    return 1;
  }

  let prefer: number | undefined;
  if (args.port !== undefined) {
    prefer = Number(args.port);
    if (!Number.isInteger(prefer) || prefer < 1024 || prefer > 65535) {
      console.error(`✖ port 要是 1024–65535 的整数，实得 ${String(args.port)}`);
      return 1;
    }
  }

  const repoDir = resolve(args.dir.trim());
  const neighborhood = dirname(repoDir);
  let result: InitResult;
  try {
    result = initSite({ repoDir, title: typeof args.title === "string" ? args.title : undefined, port: prefer });
  } catch (error) {
    console.error(`✖ ${error instanceof Error ? error.message : String(error)}`);
    return 1;
  }

  console.log(`仓：${repoDir}`);
  console.log(`邻居（扫端口）：${neighborhood}`);
  const taken = [...result.used.keys()].sort((a, b) => a - b);
  console.log(`已占端口：${taken.join("、") || "（一个都没有）"}`);
  if (prefer !== undefined && result.used.has(prefer)) console.log(`⚠ ${prefer} 已经被 ${result.used.get(prefer)} 占了，还是让给你`);
  console.log(`这个站用：${result.port}`);
  for (const rel of result.written) console.log(`  + ${rel}`);

  if (result.missing.length > 0) {
    console.log(`
仓根 .gitignore 里还缺这几条（**没替你改**，自己加）：
${result.missing.map((line) => `  ${line}`).join("\n")}`);
  }
  if (result.overwrites.length > 0) {
    console.log(`
⚠ 仓根已有 ${result.overwrites.join("、")}：站里 outputs 预置了映射，第一次 pnpm doc:render 会**覆盖**它们。
  先把内容搬进 docs-site/content/outputs/ 下对应的 mdx（那是正本），再 render。`);
  }

  console.log(`
接着做：
  cd ${result.target}
  pnpm install
  pnpm doc:render     # 摆出仓根 AGENTS.md / README.md（正本在 content/outputs/）
  pnpm doc            # livedoc check
  pnpm dev            # http://localhost:${result.port}

六区：docs 现状、trajectory 轨迹（卡 .mdx）、spec 交接（做完删页）、future 未来、outputs 生成正本、
feedback 反馈；只有 docs 与 outputs 进 check。起手页写了第一条引用怎么钉：钉完先落一个提交，再
pnpm doc:confirm——git 比较器只对已提交、工作区干净的内容钉。文档写什么、怎么排，见随包发的
skill「livedoc-docs」。`);
  return 0;
}
