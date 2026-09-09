/**
 * livedoc 的动作，编排在这儿。可执行那一头在 cli.ts——测试直接调 main，不用起子进程。
 * cwd 就是项目根（那里有 livedoc.config.mjs）。
 *   livedoc check [--json]                 核对：只读，红退 1；挂了 outputs 映射的文档顺手守生成物新鲜度；
 *                                          配了 trajectory 目录的顺手跑卡校验，病卡也算红。--json 出整份
 *                                          机读报告（形状见 report.ts），退出码不变
 *   livedoc confirm                        确认：出记录、清孤儿、写回文档；有钉不住的整篇拒，打印并退 1
 *                                          文档本身删了、挪了的，它的记录 check 算红、confirm 整个忘掉
 *   livedoc render --target human|ai       渲染：产物落 out/；挂了 outputs 映射的 ai 产物摆到指定目标（不再落 out/）
 *   livedoc trajectory [--json]            列轨迹卡的盘 / 树 / 主干；--json 出 buildTrajectory 的整份模型
 *   livedoc init --dir <仓> [--title][--port]  往一个已有仓里铺一个接好 livedoc 的六区 fumadocs 站
 * 新引用不用命令：在文档里写一行核心定的草稿记号 @@livedoc ref src/greet.ts:2-3 @@，
 * check 认它、报未确认，confirm 换成该格式的正式记号。
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, relative, sep } from "node:path";
import { targetKey } from "@godcreator02/live-doc-core";
import type { Format, Item, Listing } from "@godcreator02/live-doc-core";
import { loadProject } from "@godcreator02/live-doc-project";
import { buildTrajectory, scanDir } from "@godcreator02/live-doc-trajectory";
import { initCommand } from "./init.ts";
import { pickFrontmatter, tidyPlaced, withFrontmatter } from "./placed.ts";
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
  // trajectory 与 init 跟 check / confirm / render 不是一套：它们不认 --target、不遍历文档，
  // init 连 livedoc.config.mjs 都不要（它是给还没有站的仓铺一个站），所以提前分流，
  // 不挤进下面那条白名单检查、也不去 loadProject
  if (argv[0] === "trajectory") return trajectoryCommand(argv.slice(1));
  if (argv[0] === "init") return initCommand(argv.slice(1));
  const [command = "check", ...rest] = argv;
  const target = rest.includes("--target") ? rest[rest.indexOf("--target") + 1] : "human";
  if (!["check", "confirm", "render"].includes(command)) {
    console.error(`不认识的命令：${command}——有 check / confirm / render / trajectory / init`);
    return 2;
  }

  const project = await loadProject(process.cwd());
  const docs = project.docs();
  if (command === "check") return checkCommand(project, docs, rest.includes("--json"));

  let red = 0;
  for (const doc of docs) {
    const text = project.read(doc);
    const format = project.service.formatFor(doc)!;
    if (command === "confirm") red += confirm(project, doc, text);
    else red += await render(project, doc, text, format, target);
  }
  // 文档本身删了、挪了：它的记录上面那圈看不到，按文档清单一览。check 算红，confirm 整个忘掉
  if (command === "confirm") {
    for (const doc of project.service.forget(docs)) console.log(`🧹 ${doc}  文档已不存在，记录已清`);
  }
  return red > 0 ? 1 : 0;
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

/** `livedoc trajectory [--json]`：没配 trajectory 目录报错退 2；`--json` 出 buildTrajectory
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

/** 摆放那份的正文：问格式包要 ai 产物，再整理成摆放产物的形态（剥站上 .md 路由的锚记、
 *  还原被保守转义的加粗星号、去掉 frontmatter 段留下的开头空行）。要带 frontmatter 的目标
 *  由调用方按 outputs 点名的字段再戴上——同一篇的几个目标共用这一份正文 */
async function renderPlaced(project: Project, doc: string, text: string, format: Format): Promise<string> {
  const listing = project.service.resolve(doc, text);
  const out = await format.renderAi!(text, listing, {
    root: project.root,
    doc,
    roster: project.roster,
    config: project.config as unknown as Record<string, unknown>,
  });
  return tidyPlaced(out);
}

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
    lines.push(`🔴 ${doc}  第 ${line} 行 <${name}>  名册外组件，livedoc.config.mjs 里没给它压平规则`);
  }
  const placed = await checkPlaced(project, doc, text, format);
  lines.push(...placed.lines);
  const red =
    items.filter((item) => item.status === "missing").length +
    orphans.length +
    components.length +
    placed.outputs.filter((output) => output.status !== "fresh").length;
  return { report: { doc, red, items, orphans, components, outputs: placed.outputs }, lines };
}

/** 摆放目标的守门：内存里重渲染一遍跟盘上比。目标不在、内容不一致、源头部缺点名的 frontmatter 字段都红
 *  ——mdx 源改了没重摆、有人直接改了生成物，都算 */
async function checkPlaced(project: Project, doc: string, text: string, format: Format): Promise<{ outputs: OutputReport[]; lines: string[] }> {
  const targets = project.placements(doc);
  if (targets.length === 0 || typeof format.renderAi !== "function") return { outputs: [], lines: [] };
  const body = await renderPlaced(project, doc, text, format);
  const outputs: OutputReport[] = [];
  const lines: string[] = [];
  for (const { to, frontmatter } of targets) {
    const picked = pickFrontmatter(text, frontmatter);
    if (picked.missing.length > 0) {
      outputs.push({ to, status: "no-frontmatter", missing: picked.missing });
      lines.push(`🔴 ${doc} → ${to}  mdx 源的 frontmatter 里没有 ${picked.missing.join("、")}——补上再 render`);
      continue;
    }
    const abs = join(project.root, to);
    if (!existsSync(abs)) {
      outputs.push({ to, status: "missing" });
      lines.push(`🔴 ${doc} → ${to}  生成物还不存在——render 摆过去`);
      continue;
    }
    const disk = readFileSync(abs, "utf8").replace(/\r\n/g, "\n");
    if (disk !== withFrontmatter(body, picked.lines)) {
      outputs.push({ to, status: "stale" });
      lines.push(`🔴 ${doc} → ${to}  生成物跟 mdx 源不一致（源改了没重摆，或有人直接改了生成物）——重跑 render`);
    } else {
      outputs.push({ to, status: "fresh" });
      lines.push(`🟢 ${doc} → ${to}  生成物跟 mdx 源一致`);
    }
  }
  return { outputs, lines };
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

async function render(project: Project, doc: string, text: string, format: Format, target: string | undefined): Promise<number> {
  const fn = target === "ai" ? format.renderAi : format.renderHuman;
  if (typeof fn !== "function") {
    console.log(
      format.final === true
        ? `·  ${doc}  ${format.name} 的产物就是文档本身，人和 AI 都读它`
        : `·  ${doc}  ${format.name} 没有 ${target} 渲染`,
    );
    return 0;
  }
  const listing = project.service.resolve(doc, text);
  const placing = target === "ai" ? project.placements(doc) : [];
  if (placing.length > 0) {
    // 挂了映射的文档只写目标：目标是纯生成物，render 直接覆盖；没挂映射的才落 out/ 当调试产物。
    // 点名了 frontmatter 字段的目标，源头部缺字段就不摆——摆一份缺 name 的 SKILL.md 比不摆更糟
    const body = await renderPlaced(project, doc, text, format);
    let red = 0;
    for (const { to, frontmatter } of placing) {
      const picked = pickFrontmatter(text, frontmatter);
      if (picked.missing.length > 0) {
        console.log(`🔴 ${doc} → ${to}  mdx 源的 frontmatter 里没有 ${picked.missing.join("、")}——补上再 render`);
        red += 1;
        continue;
      }
      const abs = join(project.root, to);
      mkdirSync(dirname(abs), { recursive: true });
      writeFileSync(abs, withFrontmatter(body, picked.lines));
      console.log(`→  ${doc}  摆放到 ${to}`);
    }
    return red;
  }
  const outDir = join(project.root, project.config.out ?? "out");
  mkdirSync(outDir, { recursive: true });
  const outName = `${doc.split("/").pop()}.${target === "ai" ? "ai.md" : "html"}`;
  // 渲染函数吃文本和清单，外加项目上下文：有自己管线的格式（fumadocs）用 root + doc 自己去编译
  const out = await fn(text, listing, {
    root: project.root,
    doc,
    roster: project.roster,
    config: project.config as unknown as Record<string, unknown>,
  });
  writeFileSync(join(outDir, outName), out);
  console.log(`→  ${doc}  渲染成 ${target}：${project.config.out ?? "out"}/${outName}`);
  return 0;
}
