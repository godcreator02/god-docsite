/**
 * docfirst 的动作，编排在这儿。命令行入口在 cli.ts——测试直接调用 main，不用启动子进程。
 * cwd 就是项目根（那里有 docfirst.config.mjs）。核对与确认的对象是现状区的文件（分区见 project/load.ts）：
 * mdx 页面与 src/components/ 下讲解组件的源码逐个处理；名册检查与生成物摆放只对 mdx 页面。
 *   docfirst check [--json]                 核对：只读，有红时退出码 1；被钉文件在文档所在的仓里有未提交改动的黄也算红
 *                                          （这次改动引起的，同一个提交里处理）；有 outputs 映射的文档同时检查生成物是否新鲜；
 *                                          同时校验内容根下 trajectory/ 的轨迹卡，病卡也算红。--json 输出整份
 *                                          机读报告（形状见 report.ts），退出码不变
 *   docfirst confirm [文档路径…]            机械写回：未确认的写上记录、挪了位置的写回新行号，再把有 outputs
 *                                          映射的文档重新摆放一遍（内容变了才写）。黄灯不动、逐条列出；红的那几处
 *                                          不动、别的照写，有红时退出码 1。带路径就是**按页限定**：只动点名的那几篇
 *   docfirst confirm <文档路径…> --accept   另外把点名页里的黄灯按今天的内容重新记；没点名页就报错、退出码 2
 *   docfirst render                         渲染：有 outputs 映射的生成正本摆放到指定落点；别的文档不渲染
 *   docfirst trajectory [--json]            列出轨迹卡星轨盘的树与主干；--json 输出星轨盘的输入（盘心、卡、病卡）与树
 *   docfirst --help | -h | help             打印用法，退出码 0，什么都不改；任一命令后面带 --help / -h 也是
 * 每条命令只接受表里认的开关（`FLAGS`），别的开关一律报错、退出码 2，什么都不改。
 * 给新建的站生成各分区初始文件那件事不在这儿——它只由 agent 做一次、生成的是模板不是判定，归工作台插件
 * `@godcreator/gwb-docfirst-workflow` 的 `docfirst.create`。这儿留的全是要在**仓**里发生的：
 * 各仓的 `pnpm doc` 与 CI 跑的就是这几条。
 * 新引用不用命令：在文档里写一行不带记录的正式记号 {/* ref file="src/greet.ts" lines="2-3" *\/}
 * （组件源码里去掉花括号；写法由 `../marker/` 定），check 认它、报未确认，confirm 在这一行写上记录。
 */
import { join, relative, sep } from "node:path";
import { REASON_TEXT } from "@godcreator/code-pin";
import { buildModel } from "@godcreator/trajectory-disk";
import type { Item, Listing } from "../reference/index.ts";
import { targetKey } from "../marker/index.ts";
import { lintComponents, mdxFormat } from "../mdx/index.ts";
import type { ConfirmStep } from "../pinning/index.ts";
import { scanCardDir } from "../cards/index.ts";
import { pathExists } from "../node/index.ts";
import { createUncommittedProbe, loadProject } from "../project/index.ts";
import type { PlacedWrite, UncommittedProbe } from "../project/index.ts";
import type { CardProblemReport, CheckReport, DocReport, OutputReport, RefReport } from "./report.ts";

export type { CardProblemReport, CheckReport, ComponentReport, DocReport, OutputReport, RefReport } from "./report.ts";

const MARK: Record<string, string> = { fresh: "🟢", changed: "🟡", missing: "🔴", unconfirmed: "⚪" };
const LABEL: Record<string, string> = {
  fresh: "新鲜",
  changed: "有变动，等作者复核",
  missing: "缺失",
  unconfirmed: "未确认，等作者确认",
};

/**
 * 各命令认的开关。**不在表里的一律拒绝**：confirm 把 `-` 开头的参数从页名里筛掉，开关若被静默忽略，
 * `confirm --help` 就成了不带页名的全部页确认，而且没有任何提示。
 */
const FLAGS: Record<string, readonly string[]> = {
  check: ["--json"],
  confirm: ["--accept"],
  render: [],
  trajectory: ["--json"],
};

/** 求助的写法：命令位上三种都认，命令后面只认两种开关（`help` 在 confirm 后面可能是页名） */
const HELP_COMMANDS = new Set(["--help", "-h", "help"]);
const HELP_FLAGS = new Set(["--help", "-h"]);

export const USAGE = `docfirst——文档钉代码的核对与确认。在有 docfirst.config.mjs 的项目根跑。

  docfirst check [--json]                核对，只读。红退 1；被钉文件在本仓有未提交改动的黄灯也算红，
                                         在同一个提交里复核并 --accept。--json 出整份机读报告，退出码不变
  docfirst confirm [文档路径…]            机械写回：未确认的记号写上记录，挪了位置的写回新行号，
                                         再重新生成挂了 outputs 映射的生成物（内容变了才写）。
                                         黄灯不动、逐条列出；红的那几处不动、别的照写，有红退 1。
                                         不带路径 = 全部页；带路径 = 按页限定，只动点名的那几篇
                                         （例：docfirst confirm content/docs/a.mdx）
  docfirst confirm <文档路径…> --accept   另外把点名页里的黄灯按今天的内容重新记。复核过才用，必须点名页
  docfirst render                        把挂了 outputs 映射的生成正本渲染到落点（内容变了才写）
  docfirst trajectory [--json]           列轨迹卡那张盘的树与主干
  docfirst --help                        打这份用法，什么都不动

不认识的开关一律报错退 2，不会被当作没写。`;

export async function main(argv: string[]): Promise<number> {
  const [command = "check", ...rest] = argv;
  // 求助开关最先处理：带着它什么都不做，哪怕同时写了别的参数
  if (HELP_COMMANDS.has(command) || rest.some((arg) => HELP_FLAGS.has(arg))) {
    console.log(USAGE);
    return 0;
  }
  const flags = FLAGS[command];
  if (flags === undefined) {
    console.error(`不认识的命令：${command}——有 ${Object.keys(FLAGS).join(" / ")}，用法看 docfirst --help`);
    return 2;
  }
  const unknown = rest.filter((arg) => arg.startsWith("-") && !flags.includes(arg));
  if (unknown.length > 0) {
    const allowed = flags.length === 0 ? "不收任何开关" : `只认 ${flags.join(" / ")}`;
    console.error(`${command} 不认识开关 ${unknown.join(" ")}（${command} ${allowed}），什么都没动。用法看 docfirst --help`);
    return 2;
  }
  const positional = rest.filter((arg) => !arg.startsWith("-"));
  if (command !== "confirm" && positional.length > 0) {
    console.error(`${command} 不收文档路径（${positional.join(" ")}）——只有 confirm 能点名页，什么都没动。用法看 docfirst --help`);
    return 2;
  }
  // trajectory 跟 check / confirm / render 不是一类：它不遍历文档，所以在装配项目之前就单独处理
  if (command === "trajectory") return trajectoryCommand(rest);

  const project = await loadProject(process.cwd());
  const docs = project.docs();
  if (command === "check") return checkCommand(project, docs, rest.includes("--json"));
  if (command === "confirm") return confirmCommand(project, docs, rest);

  let red = 0;
  for (const doc of docs) {
    if (project.placements(doc).length > 0) red += render(project, doc);
  }
  return red > 0 ? 1 : 0;
}

/**
 * confirm 的全过程：逐篇机械写回，再把有 outputs 映射的全部文档重新摆放一遍。
 *
 * 带路径是**按页限定**——只动点名的那几篇：同一个仓里别人钉的黄还等着他复核，一并确认掉就是替别人做了复核。
 * `--accept` 确认的就是黄灯，所以必须点名页；不点名直接以退出码 2 退出，什么都不动。
 * 摆放不按页限定：正本改没改、生成物要不要跟着更新，按内容判断，内容没变的落点一个字节都不写。
 */
async function confirmCommand(project: Project, docs: string[], rest: string[]): Promise<number> {
  const accept = rest.includes("--accept");
  const named = rest.filter((arg) => !arg.startsWith("-"));
  if (accept && named.length === 0) {
    console.error("--accept 要点名页：docfirst confirm <文档路径…> --accept——签黄灯得说清是哪几页，什么都没动");
    return 2;
  }
  let pages = docs;
  if (named.length > 0) {
    const picked = pickDocs(project, docs, named);
    if ("unknown" in picked) {
      console.error(`不是这个项目里的文档：${picked.unknown.join("、")}——什么都没动`);
      return 2;
    }
    pages = picked.docs;
    console.log(`·  按页限定：只动 ${pages.join("、")}，别的页不碰`);
  }
  let red = 0;
  for (const doc of pages) red += confirm(project, doc, accept);
  red += replaceOutputs(project, docs);
  return red > 0 ? 1 : 0;
}

/** 点名解析：三种路径写法都接受，对不上的当场报错，不静默跳过——少确认一页比报错难发现得多 */
function pickDocs(project: Project, docs: string[], named: string[]): { docs: string[] } | { unknown: string[] } {
  const alive = new Set(docs);
  const picked: string[] = [];
  const unknown: string[] = [];
  for (const raw of named) {
    const doc = project.docIdOf(raw);
    if (alive.has(doc)) picked.push(doc);
    else unknown.push(raw);
  }
  return unknown.length > 0 ? { unknown } : { docs: [...new Set(picked)] };
}

/** 一篇的机械写回：逐处打印一行结果，返回这篇的红（缺失与钉不住的） */
function confirm(project: Project, doc: string, accept: boolean): number {
  const { text, changed, steps } = project.pinning.confirmDoc(doc, project.read(doc), { accept });
  if (changed) project.write(doc, text);
  let red = 0;
  for (const step of steps) {
    const line = confirmLine(doc, step);
    if (line !== null) console.log(line);
    if (step.action === "refused") red += 1;
  }
  return red;
}

/** 确认时一处引用打印的那一行；位置没变的绿灯不打印 */
function confirmLine(doc: string, { item, action, written, problem }: ConfirmStep): string | null {
  const key = targetKey(item.reference.target);
  switch (action) {
    case "recorded":
      return `✅ ${doc}  ${key}  已确认，写上了记录`;
    case "moved": {
      const target = written!.target;
      return `✅ ${doc}  ${key}  内容没变、挪到了 ${target.kind === "span" ? `${target.a}-${target.b}` : "新位置"}，已写回新行号`;
    }
    case "accepted":
      return `✅ ${doc}  ${key}  已按今天的内容重新记下`;
    case "needs-accept":
      return `🟡 ${doc}  ${key}  ${LABEL.changed}${detailOf(item)}——复核后 docfirst confirm ${doc} --accept`;
    case "refused":
      return `🔴 ${doc}  第 ${item.reference.at + 1} 行 ${key}  ${problem ?? `${LABEL.missing}${detailOf(item)}`}，这处没动`;
    case "unchanged":
      return null;
  }
}

/** 把有 outputs 映射的文档重新摆放一遍，内容变了的才写、才打印一行；返回没摆放成功的落点数（红） */
function replaceOutputs(project: Project, docs: string[]): number {
  let red = 0;
  for (const doc of docs) {
    for (const placed of project.placing.render(doc)) {
      if (placed.status === "placed") console.log(`→  ${doc}  重新摆放到 ${placed.to}`);
      if (placed.status === "no-frontmatter" || placed.status === "unrenderable") {
        console.log(unplacedLine(doc, placed, "confirm"));
        red += 1;
      }
    }
  }
  return red;
}

/** 一个落点没摆放成功时打印的那一行：源头部缺点名的字段，或源里有渲染不了的东西；again 是改好之后再跑哪条命令 */
function unplacedLine(doc: string, { to, status, missing, reason }: PlacedWrite | OutputReport, again: string): string {
  const head = `🔴 ${doc} → ${to}`;
  if (status === "no-frontmatter") return `${head}  mdx 源的 frontmatter 里没有 ${(missing ?? []).join("、")}——补上再 ${again}`;
  return `${head}  正本渲染不了：${reason}——改好再 ${again}`;
}

/**
 * check 的全过程：逐篇核对 → 卡校验，先汇总成一份报告再决定怎么输出。
 * 人读模式一行一处、边算边打印（每篇的行在 check 里就排好了）；`--json` 汇总完把整份打印成一行。
 * 两种模式算的是同一份报告——红的口径不可能对不上。
 */
async function checkCommand(project: Project, docs: string[], json: boolean): Promise<number> {
  const report: CheckReport = { ok: true, red: 0, docs: [], trajectory: [] };
  const uncommitted = createUncommittedProbe(project.root);
  for (const doc of docs) {
    const { report: entry, lines } = await check(project, doc, project.read(doc), uncommitted);
    report.docs.push(entry);
    report.red += entry.red;
    if (!json) for (const line of lines) console.log(line);
  }
  report.trajectory = await checkTrajectory(project);
  report.red += report.trajectory.length;
  report.ok = report.red === 0;
  if (json) {
    console.log(JSON.stringify(report));
  } else {
    for (const p of report.trajectory) console.log(`🔴 ${p.path}  ${p.field}：${p.reason}（${p.value}）`);
  }
  return report.ok ? 0 : 1;
}

/** check 同时做的卡校验：轨迹卡目录还没建（scanCardDir 返回空结果）不算红。
 * 每条病一条，path 相对项目根；人读模式打印成 `🔴 <path>  <field>：<reason>（<value>）`。 */
async function checkTrajectory(project: Project): Promise<CardProblemReport[]> {
  const { sick } = await scanCardDir(project.trajectoryDir);
  const out: CardProblemReport[] = [];
  for (const file of sick) {
    const path = relative(project.root, join(project.trajectoryDir, file.path)).split(sep).join("/");
    for (const p of file.problems) out.push({ path, field: p.field, value: p.value, reason: p.reason });
  }
  return out;
}

/** `docfirst trajectory [--json]`：轨迹卡目录还没建就报错、退出码 2；`--json` 输出星轨盘的输入（盘心、卡、病卡）与建模得到的树；
 * 不带 `--json` 打印星轨盘——根卡与盘上的卡数，每棵树的主干，再一行汇总支线 / 孤星数。 */
async function trajectoryCommand(rest: string[]): Promise<number> {
  const project = await loadProject(process.cwd());
  if (!pathExists(project.trajectoryDir)) {
    console.error(`这个项目还没有轨迹卡目录 ${project.contentDir}/trajectory`);
    return 2;
  }
  const scan = await scanCardDir(project.trajectoryDir);
  const model = buildModel(scan);
  if (rest.includes("--json")) {
    console.log(JSON.stringify({ ...scan, trees: model.trees }));
    return 0;
  }
  const rootText = model.center ? `${model.center.label}（${model.center.id}）` : "没认出根卡（卡目录里根卡不是恰好一张，见 docfirst check）";
  console.log(`盘 ${rootText}  ${model.cards.length} 张卡`);
  for (const tree of model.trees) console.log(`  主干：${tree.spine.join(" → ")}`);
  const sublineCount = model.trees.reduce((n, t) => n + t.sublines.length, 0);
  console.log(`  支线 ${sublineCount} 条，孤星 ${model.isolated.length} 张`);
  return 0;
}

type Project = Awaited<ReturnType<typeof loadProject>>;

/** 一行说明后面的括号：状态的细分理由（`changed` 就是状态本身，不另说），或目录树的项数 */
function detailOf(item: Item): string {
  if (item.reason !== undefined && item.reason !== "changed") return `（${REASON_TEXT[item.reason]}）`;
  if (item.reference.target.kind !== "tree" || item.current === null) return "";
  return `（${item.current.length} 项）`;
}

/** 一处引用的机读条目：目标文本、种类、状态、记号所在行（1 起）、今天的位置；理由、diff、拦提交有才带 */
function refReport(item: Item, blocking: boolean): RefReport {
  return {
    target: targetKey(item.reference.target),
    kind: item.reference.target.kind,
    status: item.status,
    line: item.reference.at + 1,
    lines: item.lines,
    ...(item.reason !== undefined ? { reason: item.reason } : {}),
    ...(item.diff !== undefined ? { diff: item.diff } : {}),
    ...(blocking ? { blocking: true as const } : {}),
  };
}

/** 一处引用在人读报告里的那一行；拦提交的黄单独一种说法，打印成红 */
function itemLine(doc: string, item: Item, blocking: boolean): string {
  const key = targetKey(item.reference.target);
  if (blocking) {
    return `🔴 ${doc}  ${key}  有变动，是本仓还没提交的改动引起的${detailOf(item)}——在同一个提交里复核，再 docfirst confirm ${doc} --accept`;
  }
  return `${MARK[item.status]} ${doc}  ${key}  ${LABEL[item.status]}${detailOf(item)}`;
}

/** 一篇文档核对完的两份产物：机读条目，加人读模式要打的行（顺序：引用、名册外组件、摆放目标） */
interface DocCheck {
  report: DocReport;
  lines: string[];
}

async function check(project: Project, doc: string, text: string, uncommitted: UncommittedProbe): Promise<DocCheck> {
  const listing: Listing = project.pinning.checkDoc(doc, text);
  const lines: string[] = [];
  const items: RefReport[] = [];
  for (const item of listing.items) {
    const blocking = item.status === "changed" && uncommitted(doc, item.reference.target);
    items.push(refReport(item, blocking));
    lines.push(itemLine(doc, item, blocking));
  }
  const isPage = mdxFormat.claims(doc);
  const components = isPage ? lintComponents(text, project.roster) : [];
  for (const { name, line } of components) {
    lines.push(`🔴 ${doc}  第 ${line} 行 <${name}>  名册外组件，docfirst.config.mjs 里没给它压平规则`);
  }
  const outputs = isPage ? project.placing.check(doc, listing) : [];
  for (const output of outputs) lines.push(placedLine(doc, output));
  const red =
    items.filter((item) => item.status === "missing" || item.blocking === true).length +
    components.length +
    outputs.filter((output) => !output.fresh).length;
  return { report: { doc, red, items, components, outputs }, lines };
}

/** 一个落点核对完打印的那一行：每种状态各一句说明，不新鲜的都红 */
function placedLine(doc: string, output: OutputReport): string {
  const head = `${output.fresh ? "🟢" : "🔴"} ${doc} → ${output.to}`;
  if (output.status === "no-frontmatter" || output.status === "unrenderable") return unplacedLine(doc, output, "render");
  if (output.status === "missing") return `${head}  生成物还不存在——render 摆过去`;
  if (output.status === "stale") return `${head}  生成物跟 mdx 源不一致（源改了没重摆，或有人直接改了生成物）——重跑 render`;
  return `${head}  生成物跟 mdx 源一致`;
}

/** 一篇生成正本摆放到它的落点：落点是纯生成物，内容变了才写；摆放的全过程归 project，这里只打印结果 */
function render(project: Project, doc: string): number {
  let red = 0;
  for (const one of project.placing.render(doc)) {
    if (one.status === "no-frontmatter" || one.status === "unrenderable") {
      console.log(unplacedLine(doc, one, "render"));
      red += 1;
    } else if (one.status === "placed") {
      console.log(`→  ${doc}  摆放到 ${one.to}`);
    } else {
      console.log(`·  ${doc} → ${one.to}  没变`);
    }
  }
  return red;
}
