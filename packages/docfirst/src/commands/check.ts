/**
 * check：逐篇核对钉、查生成正本的名册与生成物、校验轨迹卡，先汇总成一份报告再决定怎么输出。
 * 人读模式一处一行，`--json` 打印整份报告；两种模式算的是同一份报告，红的口径对得上。
 */
import { join, relative, sep } from "node:path";
import { diffText, parseMdx, targetKey } from "@godcreator/code-pin";
import type { DocPin, PinCheck } from "@godcreator/code-pin";
import { createUncommittedProbe } from "@godcreator/code-pin/node";
import type { UncommittedProbe } from "@godcreator/code-pin/node";
import { unknownComponents } from "@godcreator/doc-export";
import { verifyOutputs } from "@godcreator/doc-export/node";
import { scanCardDir } from "@godcreator/trajectory/node";
import type { Project } from "../project.ts";
import type { CardProblemReport, CheckReport, DocReport, OutputReport, RefReport } from "../report.ts";
import { outputCheckLine, pinCheckLine, unknownComponentLine } from "../text.ts";

function refReport(check: PinCheck<DocPin>, blocking: boolean): RefReport {
  return {
    target: targetKey(check.pin.target),
    kind: check.pin.target.kind,
    status: check.status,
    line: check.pin.line,
    lines: check.lines,
    ...(check.reason !== undefined ? { reason: check.reason } : {}),
    ...(check.diff !== undefined ? { diff: diffText(check.diff) } : {}),
    ...(blocking ? { blocking: true as const } : {}),
  };
}

/** 一篇核对完的两份产物：机读条目，与人读模式要打印的行（顺序：钉、名册外组件、生成物） */
interface DocChecked {
  report: DocReport;
  lines: string[];
}

function checkDoc(project: Project, doc: string, uncommitted: UncommittedProbe): DocChecked {
  const text = project.read(doc);
  const lines: string[] = [];
  const items: RefReport[] = [];
  for (const check of project.pins.pinning.checkDoc(doc, text).checks) {
    const blocking = check.status === "changed" && uncommitted(doc, check.pin.target);
    items.push(refReport(check, blocking));
    lines.push(pinCheckLine(doc, check, blocking));
  }
  // 机读文字只给生成物：只有生成正本里的组件要在名册里有规则
  const isOutputSource = project.isOutputSource(doc);
  const components = isOutputSource ? unknownComponents(parseMdx(text), project.config.roster) : [];
  for (const { name, line } of components) lines.push(unknownComponentLine(doc, name, line));
  const outputs: OutputReport[] = isOutputSource ? verifyOutputs(project.outputs, [doc]).map(({ doc: _source, ...output }) => output) : [];
  for (const output of outputs) lines.push(outputCheckLine(doc, output));
  const red = items.filter((item) => item.status === "missing" || item.blocking === true).length + components.length + outputs.filter((output) => !output.fresh).length;
  return { report: { doc, red, items, components, outputs }, lines };
}

/** 轨迹卡校验：卡目录还没建不算红；每条病一条，path 相对项目根 */
async function checkTrajectory(project: Project): Promise<CardProblemReport[]> {
  const dir = join(project.root, project.config.trajectoryDir);
  const { sick } = await scanCardDir(dir);
  return sick.flatMap((file) => {
    const path = relative(project.root, join(dir, file.path)).split(sep).join("/");
    return file.problems.map((p) => ({ path, field: p.field, value: p.value, reason: p.reason }));
  });
}

export async function checkCommand(project: Project, json: boolean): Promise<number> {
  const report: CheckReport = { ok: true, red: 0, docs: [], trajectory: [] };
  const uncommitted = createUncommittedProbe(project.root);
  for (const doc of project.docs) {
    const { report: entry, lines } = checkDoc(project, doc, uncommitted);
    report.docs.push(entry);
    report.red += entry.red;
    if (!json) for (const line of lines) console.log(line);
  }
  report.trajectory = await checkTrajectory(project);
  report.red += report.trajectory.length;
  report.ok = report.red === 0;
  if (json) console.log(JSON.stringify(report));
  else for (const p of report.trajectory) console.log(`🔴 ${p.path}  ${p.field}：${p.reason}（${p.value}）`);
  return report.ok ? 0 : 1;
}
