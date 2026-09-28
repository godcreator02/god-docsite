/**
 * 四条命令各自的全过程：check、confirm、render、trajectory。调用装配好的项目与卡格式，逐行打印结果，交回退出码。
 */
import { join, relative, sep } from "node:path";
import { buildModel } from "@godcreator/trajectory-disk";
import type { Item, Listing } from "../reference/index.ts";
import { targetKey } from "../marker/index.ts";
import { lintComponents, mdxFormat } from "../mdx/index.ts";
import { scanCardDir } from "../cards/index.ts";
import { pathExists } from "../node/index.ts";
import { createUncommittedProbe, loadProject } from "../project/index.ts";
import type { Project, UncommittedProbe } from "../project/index.ts";
import type { CardProblemReport, CheckReport, DocReport, RefReport } from "./report.ts";
import { pickDocs } from "./args.ts";
import { confirmLine, itemLine, placedLine, unplacedLine } from "./text.ts";

/**
 * confirm 的全过程：逐篇机械写回，再把有 outputs 映射的全部文档重新摆放一遍。
 *
 * 带路径是**按页限定**——只动点名的那几篇：同一个仓里别人的黄灯引用还等着他复核，一并确认掉就是替别人做了复核。
 * `--accept` 确认的就是黄灯，所以必须点名页；不点名直接以退出码 2 退出，什么都不动。
 * 摆放不按页限定：正本改没改、生成物要不要跟着更新，按内容判断，内容没变的落点一个字节都不写。
 */
export async function confirmCommand(project: Project, docs: string[], rest: string[]): Promise<number> {
  const accept = rest.includes("--accept");
  const named = rest.filter((arg) => !arg.startsWith("-"));
  if (accept && named.length === 0) {
    console.error("--accept 要点名页：docfirst confirm <文档路径…> --accept——确认黄灯得说清是哪几页，什么都没动");
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

/**
 * check 的全过程：逐篇核对 → 卡校验，先汇总成一份报告再决定怎么输出。
 * 人读模式一行一处、边算边打印（每篇的行在 check 里就排好了）；`--json` 汇总完把整份打印成一行。
 * 两种模式算的是同一份报告——红的口径不可能对不上。
 */
export async function checkCommand(project: Project, docs: string[], json: boolean): Promise<number> {
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
export async function trajectoryCommand(rest: string[]): Promise<number> {
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
    lines.push(`🔴 ${doc}  第 ${line} 行 <${name}>  名册外组件，docfirst.config.mjs 里没给它机读规则`);
  }
  const outputs = isPage ? project.placing.check(doc, listing) : [];
  for (const output of outputs) lines.push(placedLine(doc, output));
  const red =
    items.filter((item) => item.status === "missing" || item.blocking === true).length +
    components.length +
    outputs.filter((output) => !output.fresh).length;
  return { report: { doc, red, items, components, outputs }, lines };
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

/** render 的全过程：有 outputs 映射的文档逐篇摆放到落点，有落点没摆放成功就退 1 */
export function renderCommand(project: Project, docs: string[]): number {
  let red = 0;
  for (const doc of docs) {
    if (project.placements(doc).length > 0) red += render(project, doc);
  }
  return red > 0 ? 1 : 0;
}
