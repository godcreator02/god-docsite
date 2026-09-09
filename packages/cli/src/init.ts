/**
 * `livedoc init` 的命令层：认参数、调建站模块、把结果与「接着做什么」打出来。
 *
 * 这一层不知道站长什么样——模板怎么渲、端口怎么挑、名字从哪儿认，全在 `./site/`
 * 那个模块里，这边只学它面上的两个方法。**建站的逻辑一行都不许回流到这儿**：
 * 它得能被别的程序直接调，不必绕命令行。
 */
import { dirname, resolve } from "node:path";
import { createSite, PORT_FROM, type SiteResult } from "./site/index.ts";

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
  let result: SiteResult;
  try {
    result = createSite({ repoDir, title: typeof args.title === "string" ? args.title : undefined, port: prefer });
  } catch (error) {
    console.error(`✖ ${error instanceof Error ? error.message : String(error)}`);
    return 1;
  }
  report(repoDir, result, prefer);
  return 0;
}

/** 铺完打什么：从哪儿扫的端口、挑了哪个、铺了哪些文件，再是两条「没替你改」的提醒与接着做什么 */
function report(repoDir: string, result: SiteResult, prefer: number | undefined): void {
  console.log(`仓：${repoDir}`);
  console.log(`邻居（扫端口）：${dirname(repoDir)}`);
  const taken = [...result.used.keys()].sort((a, b) => a - b);
  console.log(`已占端口：${taken.join("、") || "（一个都没有）"}`);
  if (prefer !== undefined && result.used.has(prefer)) console.log(`⚠ ${prefer} 已经被 ${result.used.get(prefer)} 占了，还是让给你`);
  console.log(`这个站用：${result.port}`);
  for (const rel of result.written) console.log(`  + ${rel}`);

  if (result.missingGitignore.length > 0) {
    console.log(`
仓根 .gitignore 里还缺这几条（**没替你改**，自己加）：
${result.missingGitignore.map((line) => `  ${line}`).join("\n")}`);
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
}
