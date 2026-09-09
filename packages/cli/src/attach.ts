/**
 * `livedoc attach` 的命令层：认参数、调装配模块、把结果与「接着做什么」打出来。
 *
 * 这一层不知道六区长什么样——模板怎么渲、名字从哪儿认、package.json 怎么合，全在 `./site/`
 * 那个模块里，这边只学它面上的两个方法。**装配的逻辑一行都不许回流到这儿**：
 * 它得能被别的程序直接调，不必绕命令行。
 */
import { resolve } from "node:path";
import { attachSite, type AttachResult } from "./site/index.ts";

const HELP = `用法：livedoc attach --dir <站目录的绝对路径> [--title <显示名>]

  --dir    必给。**已经铺好的 fumadocs 骨架**（约定是 <仓>/docs-site），且还没接过 livedoc
  --title  站的显示名，缺省从仓根 package.json 的 name 里取，再退回仓的目录名

骨架怎么铺不归 livedoc：装了 fumadocs 的人才该有那个能力。工作台里是站件那条
docs-site.create，手铺也行——只要 package.json 的依赖里有 fumadocs-core / -mdx / -ui 任一。

**只在刚铺好的骨架上跑**：站里已经有 livedoc.config.mjs、或 content/ 下已经有骨架之外的内容，
这条命令报一句「这个站已有内容，请人工接线」退 1，一个字不改写。`;

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

/** `livedoc attach`：认参数、装六区、把接着做什么打出来。红了退 1，只要 help 退 0 */
export function attachCommand(argv: string[]): number {
  const args = parseArgs(argv);
  if (args.help === true) {
    console.log(HELP);
    return 0;
  }
  if (typeof args.dir !== "string") {
    console.error(HELP);
    return 1;
  }

  const siteDir = resolve(args.dir.trim());
  let result: AttachResult;
  try {
    result = attachSite({ siteDir, title: typeof args.title === "string" ? args.title : undefined });
  } catch (error) {
    console.error(`✖ ${error instanceof Error ? error.message : String(error)}`);
    return 1;
  }
  report(result);
  return 0;
}

/** 装完打什么：装在哪、写了哪些文件、删了哪些让位的，再是一条「没替你改」的提醒与接着做什么 */
function report(result: AttachResult): void {
  console.log(`站：${result.target}`);
  console.log(`仓（钉的代码在这儿）：${result.repoDir}`);
  console.log(`站跑在骨架挑的那个口：${result.port}`);
  for (const rel of result.written) console.log(`  + ${rel}`);
  for (const rel of result.superseded) console.log(`  - ${rel}（骨架那份 DocsLayout 让位给六区的根 layout）`);

  if (result.overwrites.length > 0) {
    console.log(`
⚠ 仓根已有 ${result.overwrites.join("、")}：站里 outputs 预置了映射，第一次 pnpm doc:render 会**覆盖**它们。
  先把内容搬进 content/outputs/ 下对应的 mdx（那是正本），再 render。`);
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
