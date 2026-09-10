/**
 * docfirst 的动作，编排在这儿。可执行那一头在 cli.ts——测试直接调 main，不用起子进程。
 * cwd 就是项目根（那里有 docfirst.config.mjs）。
 *   docfirst check [--json]                 核对：只读，红退 1；挂了 outputs 映射的文档顺手守生成物新鲜度；
 *                                          配了 trajectory 目录的顺手跑卡校验，病卡也算红。--json 出整份
 *                                          机读报告（形状见 report.ts），退出码不变
 *   docfirst confirm [文档路径…]            确认：出记录、清孤儿、写回文档；有钉不住的整篇拒，打印并退 1
 *                                          文档本身删了、挪了的，它的记录 check 算红、confirm 整个忘掉
 *                                          带路径就是**按页限定**：只动点名的那几篇，别的页与别人的记录一个字不改
 *   docfirst render                         渲染：产物落 out/；挂了 outputs 映射的摆到指定落点（不再落 out/）
 *   docfirst trajectory [--json]            列轨迹卡的盘 / 树 / 主干；--json 出 buildTrajectory 的整份模型
 * **四条到此为止**：给一个新骨架铺六区那条不在这儿——那件事只在 agent 手上发生一次、铺的是
 * 模板不是判定，归工作台件 `@godcreator02/gwb-docfirst-workflow` 的 `docfirst.attach`。这儿留的全是
 * 要在**仓**里发生的：各仓的 `pnpm doc` 与 CI 跑的就是这四条。
 * 新引用不用命令：在文档里写一行记号语法（engine/marker.ts）定的草稿记号 @@docfirst ref src/greet.ts:2-3 @@，
 * check 认它、报未确认，confirm 换成该格式的正式记号。
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { targetKey } from "../engine/index.ts";
import type { Format, Item, Listing } from "../engine/index.ts";
import { loadProject } from "../host/index.ts";
import { buildTrajectory, scanDir } from "@godcreator02/docfirst-trajectory";
import type { CardProblemReport, CheckReport, DocReport, OutputReport, RefReport } from "./report.ts";

export type { CardProblemReport, CheckReport, ComponentReport, DocReport, OutputReport, RefReport } from "./report.ts";

const MARK: Record<string, string> = { fresh: "🟢", changed: "🟡", missing: "🔴", unconfirmed: "⚪" };
const LABEL: Record<string, string> = {
  fresh: "新鲜",
  changed: "有变动，等作者复核",
  missing: "缺失，引用指向空气",
  unconfirmed: "未确认，等作者确认",
};
/** 状态的细分理由：红说清楚是哪一种「指向空气」，黄说清楚是不是找不着了 */
const REASON: Record<string, string> = {
  vanished: "整段已被删光",
  "file-missing": "文件不在了",
  "blob-missing": "记忆里的 blob 不在对象库（浅克隆或历史重写过），重新确认一次",
  "dir-missing": "目录不在了",
  appeared: "断言它不在，它却出现了",
  "type-changed": "文件和目录换了个",
  "text-missing": "文件里没有这个名字了",
  unlocated: "hash 记忆找不到这段了，位置不明——重读源码、重钉",
};
/** 确认时拿到的是哪种记忆：hash 是弱记忆（没有旧内容、变了就找不着），写手得知道 */
const MEMORY: Record<string, string> = { hash: "（hash 记忆：不在 git 里）" };

export async function main(argv: string[]): Promise<number> {
  const [command = "check", ...rest] = argv;
  // trajectory 跟 check / confirm / render 不是一套：它不遍历文档，所以在装配之前就分流，
  // 也不进下面那条白名单
  if (command === "trajectory") return trajectoryCommand(rest);
  if (!["check", "confirm", "render"].includes(command)) {
    console.error(`不认识的命令：${command}——有 check / confirm / render / trajectory`);
    return 2;
  }

  const project = await loadProject(process.cwd());
  const docs = project.docs();
  if (command === "check") return checkCommand(project, docs, rest.includes("--json"));
  if (command === "confirm") return confirmCommand(project, docs, rest);

  let red = 0;
  for (const doc of docs) {
    red += await render(project, doc, project.read(doc), project.service.formatFor(doc)!);
  }
  return red > 0 ? 1 : 0;
}

/**
 * confirm 的整趟。不带路径是整仓一趟；带路径是**按页限定**——只动点名的那几篇。
 *
 * 限定是为了让「只改了这几页」的改动能只确认这几页：同一个仓里别人钉的黄还等着他复核，
 * 顺手 confirm 掉就是替别人签字。
 *
 * 孤儿清理分两层，限定模式各自的去处不同：
 *   **一页之内**的孤儿（记录簿里有、这一页正文里已经没有这处引用）由 service.confirm 顺手清。
 *   它本来就只看这一页，限定不限定都成立，照做。
 *   **整仓那层**（记录簿里有、整个项目里已经没有这篇文档）不能按限定后的清单算：那份清单是人
 *   点名的一小撮，拿它当「现存文档的全集」去算，没点名的页会被全部当成「文档已不存在」抹掉。
 *   所以限定模式只清点名了的那几篇——点名一篇已经删掉或挪走的页，意思就是「把它的记录忘掉」，
 *   这也正是挪页时要的：旧路径点一次，新路径点一次，一趟走完。
 */
async function confirmCommand(project: Project, docs: string[], rest: string[]): Promise<number> {
  const named = rest.filter((arg) => !arg.startsWith("--"));
  let red = 0;
  if (named.length === 0) {
    for (const doc of docs) red += confirm(project, doc, project.read(doc));
    // 文档本身删了、挪了：它的记录上面那圈看不到，按文档清单一览。check 算红，confirm 整个忘掉
    for (const doc of project.service.forget(docs)) console.log(`🧹 ${doc}  文档已不存在，记录已清`);
    return red > 0 ? 1 : 0;
  }

  const picked = pickDocs(project, docs, named);
  if ("problem" in picked) {
    console.error(`不是这个项目里的文档，记录簿里也没有：${picked.problem.join("、")}`);
    return 2;
  }
  console.log(`·  按页限定：只动 ${[...picked.live, ...picked.gone].join("、")}，别的页与它们的记录不碰`);
  for (const doc of picked.live) red += confirm(project, doc, project.read(doc));
  // 只忘点名的那几篇：留下的 = 现存文档 + 没被点名的失踪文档
  const drop = new Set(picked.gone);
  const keep = [...docs, ...project.service.strays(docs).filter((doc) => !drop.has(doc))];
  for (const doc of project.service.forget(keep)) console.log(`🧹 ${doc}  文档已不存在，记录已清`);
  return red > 0 ? 1 : 0;
}

/**
 * 按页限定的点名解析：还在的页要确认（live），已经不在、但记录簿里还留着记录的页只清记录（gone）。
 * 两边都对不上就是拼错了——当场报错，不静默跳过：少确认一页比报错难发现得多。
 */
function pickDocs(project: Project, docs: string[], named: string[]): { live: string[]; gone: string[] } | { problem: string[] } {
  const alive = new Set(docs);
  const strays = new Set(project.service.strays(docs));
  const live: string[] = [];
  const gone: string[] = [];
  const problem: string[] = [];
  for (const raw of named) {
    const doc = project.docIdOf(raw);
    if (alive.has(doc)) live.push(doc);
    else if (strays.has(doc)) gone.push(doc);
    else problem.push(raw);
  }
  if (problem.length > 0) return { problem };
  return { live: [...new Set(live)], gone: [...new Set(gone)] };
}

/**
 * check 的整趟：逐篇核对 → 失踪文档 → 卡校验，先攒成一份报告再决定怎么出。
 * 人读模式一行一处、边算边打（每篇的行在 check 里就排好了）；`--json` 攒完整份一行打出去。
 * 两种模式算的是同一份报告——红的口径不可能对不上。
 */
async function checkCommand(project: Project, docs: string[], json: boolean): Promise<number> {
  const report: CheckReport = { ok: true, red: 0, docs: [], strays: [], trajectory: [] };
  for (const doc of docs) {
    const { report: entry, lines } = await check(project, doc, project.read(doc), project.service.formatFor(doc)!);
    report.docs.push(entry);
    report.red += entry.red;
    if (!json) for (const line of lines) console.log(line);
  }
  report.strays = project.service.strays(docs);
  report.trajectory = await checkTrajectory(project);
  report.red += report.strays.length + report.trajectory.length;
  report.ok = report.red === 0;
  if (json) {
    console.log(JSON.stringify(report));
  } else {
    for (const doc of report.strays) console.log(`🔴 ${doc}  文档已不存在，记录簿里还留着它的记录——confirm 会清掉`);
    for (const p of report.trajectory) console.log(`🔴 ${p.path}  ${p.field}：${p.reason}（${p.value}）`);
  }
  return report.ok ? 0 : 1;
}

/** check 顺带跑的卡校验：trajectoryDir 没配就不管；目录不存在（scanDir 回空）不算红。
 * 每条病一条，path 相对项目根；人读模式打成 `🔴 <path>  <field>：<reason>（<value>）`。 */
async function checkTrajectory(project: Project): Promise<CardProblemReport[]> {
  if (project.trajectoryDir === null) return [];
  const { sick } = await scanDir(project.trajectoryDir);
  const out: CardProblemReport[] = [];
  for (const file of sick) {
    const path = relative(project.root, join(project.trajectoryDir, file.path)).split(sep).join("/");
    for (const p of file.problems) out.push({ path, field: p.field, value: p.value, reason: p.reason });
  }
  return out;
}

/** `docfirst trajectory [--json]`：没配 trajectory 目录报错退 2；`--json` 出 buildTrajectory
 * 整份模型；不带 `--json` 按盘打印——每盘一段，列每棵树的主干，再一行汇总支线 / 孤星 / 虫洞数。 */
async function trajectoryCommand(rest: string[]): Promise<number> {
  const project = await loadProject(process.cwd());
  if (project.trajectoryDir === null) {
    console.log("这个项目没配 trajectory 目录");
    return 2;
  }
  const data = await buildTrajectory(project.trajectoryDir);
  if (rest.includes("--json")) {
    console.log(JSON.stringify(data));
    return 0;
  }
  for (const disk of data.disks) {
    const model = data.models[disk.rootId];
    console.log(`盘 ${model?.root?.label ?? disk.rootId}（${disk.rootId}）  ${disk.memberIds.length} 张卡`);
    for (const tree of model?.trees ?? []) console.log(`  主干：${tree.spine.join(" → ")}`);
    const sublineCount = model?.trees.reduce((n, t) => n + t.sublines.length, 0) ?? 0;
    console.log(`  支线 ${sublineCount} 条，孤星 ${model?.isolated.length ?? 0} 张，虫洞 ${model?.wormholes.length ?? 0} 个`);
  }
  return 0;
}

type Project = Awaited<ReturnType<typeof loadProject>>;

/** 一行说明后面的括号：红的理由，目录树的项数或多了少了哪些 */
function detailOf(item: Item): string {
  if (item.reason !== undefined && REASON[item.reason] !== undefined) return `（${REASON[item.reason]}）`;
  if (item.reference.target.kind !== "tree") return "";
  if (item.status === "changed" && item.diff !== undefined) {
    const marks = item.diff
      .split("\n")
      .filter((line) => line.startsWith("+ ") || line.startsWith("- "))
      .map((line) => `${line[0]} ${line.slice(2)}`);
    return `（${marks.join("，")}）`;
  }
  return item.current === null ? "" : `（${item.current.length} 项）`;
}

/** 一处引用的机读条目：目标键、种类、状态、记号所在行（1 起）、今天的位置；理由与 diff 有才带 */
function refReport(item: Item): RefReport {
  return {
    target: targetKey(item.reference.target),
    kind: item.reference.target.kind,
    status: item.status,
    line: item.reference.at + 1,
    lines: item.lines,
    draft: item.reference.extra?.draft === true,
    ...(item.reason !== undefined ? { reason: item.reason } : {}),
    ...(item.diff !== undefined ? { diff: item.diff } : {}),
  };
}

/** 一篇文档核对完的两份产物：机读条目，加人读模式要打的行（顺序：引用、孤儿、名册外组件、摆放目标） */
interface DocCheck {
  report: DocReport;
  lines: string[];
}

async function check(project: Project, doc: string, text: string, format: Format): Promise<DocCheck> {
  const listing: Listing = project.service.resolve(doc, text);
  const lines: string[] = [];
  const items: RefReport[] = [];
  for (const item of listing.items) {
    items.push(refReport(item));
    lines.push(`${MARK[item.status]} ${doc}  ${targetKey(item.reference.target)}  ${LABEL[item.status]}${detailOf(item)}`);
  }
  const orphans: string[] = [];
  for (const orphan of listing.orphans) {
    orphans.push(targetKey(orphan.target));
    lines.push(`🔴 ${doc}  ${targetKey(orphan.target)}  孤儿记录：文档里已经没有这处引用`);
  }
  const components = typeof format.lintComponents === "function" ? format.lintComponents(text, project.roster) : [];
  for (const { name, line } of components) {
    lines.push(`🔴 ${doc}  第 ${line} 行 <${name}>  名册外组件，docfirst.config.mjs 里没给它压平规则`);
  }
  const outputs = await project.placing.check(doc);
  for (const output of outputs) lines.push(placedLine(doc, output));
  const red =
    items.filter((item) => item.status === "missing").length +
    orphans.length +
    components.length +
    outputs.filter((output) => !output.fresh).length;
  return { report: { doc, red, items, orphans, components, outputs }, lines };
}

/** 一个落点核对完打成的那一行：四态各一句人话，不新鲜的都红 */
function placedLine(doc: string, output: OutputReport): string {
  const head = `${output.fresh ? "🟢" : "🔴"} ${doc} → ${output.to}`;
  if (output.status === "no-frontmatter") return `${head}  mdx 源的 frontmatter 里没有 ${(output.missing ?? []).join("、")}——补上再 render`;
  if (output.status === "missing") return `${head}  生成物还不存在——render 摆过去`;
  if (output.status === "stale") return `${head}  生成物跟 mdx 源不一致（源改了没重摆，或有人直接改了生成物）——重跑 render`;
  return `${head}  生成物跟 mdx 源一致`;
}

function confirm(project: Project, doc: string, text: string): number {
  const { listing, text: next, changed, problems, pinned } = project.service.confirm(doc, text);
  if (problems.length > 0) {
    // 一处钉不住整篇拒：记录簿一条不写，文档一个字不改
    for (const problem of problems) console.log(`🔴 ${problem}`);
    console.log(`·  ${doc}  这篇整篇没确认——上面几处先处理掉`);
    return problems.length;
  }
  if (changed) project.write(doc, next);
  listing.items.forEach((item, i) => {
    const how = item.reference.extra?.draft === true ? "，草稿记号已换成正式记号" : changed ? "，文档已写回" : "";
    const memory = MEMORY[pinned[i]?.record.kind ?? ""] ?? "";
    console.log(`✅ ${doc}  ${targetKey(item.reference.target)}  已确认${how}${memory}`);
  });
  for (const orphan of listing.orphans) console.log(`🧹 ${doc}  ${targetKey(orphan.target)}  孤儿记录已清`);
  return 0;
}

async function render(project: Project, doc: string, text: string, format: Format): Promise<number> {
  // 挂了映射的文档只写落点：落点是纯生成物，render 直接覆盖；摆放的整趟归 project，这边只印结果
  const placed = await project.placing.render(doc);
  if (placed.length > 0) {
    let red = 0;
    for (const { to, status, missing } of placed) {
      if (status === "no-frontmatter") {
        console.log(`🔴 ${doc} → ${to}  mdx 源的 frontmatter 里没有 ${(missing ?? []).join("、")}——补上再 render`);
        red += 1;
      } else {
        console.log(`→  ${doc}  摆放到 ${to}`);
      }
    }
    return red;
  }
  if (typeof format.renderAi !== "function") {
    console.log(
      format.final === true
        ? `·  ${doc}  ${format.name} 的产物就是文档本身，人和 AI 都读它`
        : `·  ${doc}  ${format.name} 没有渲染`,
    );
    return 0;
  }
  // 没挂映射的落 out/ 当调试产物。渲染函数吃文本和清单，外加项目上下文：
  // 有自己管线的格式（fumadocs）用 root + doc 自己去编译
  const outDir = join(project.root, project.config.out ?? "out");
  mkdirSync(outDir, { recursive: true });
  const outName = `${doc.split("/").pop()}.ai.md`;
  const out = await format.renderAi(text, project.service.resolve(doc, text), {
    root: project.root,
    doc,
    roster: project.roster,
    config: project.config as unknown as Record<string, unknown>,
  });
  writeFileSync(join(outDir, outName), out);
  console.log(`→  ${doc}  渲染成 ${project.config.out ?? "out"}/${outName}`);
  return 0;
}
