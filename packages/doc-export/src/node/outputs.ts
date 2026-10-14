/**
 * 生成物落盘与核对：读正本、按 core 算出每个落点该是什么，render 写有变的落点，verify 只读、报每个落点的状态。
 * 正本与落点都相对项目根。
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, isAbsolute, join, relative, resolve, sep } from "node:path";
import type { Pinner } from "@godcreator/code-pin";
import { planOutputs, sameOutput } from "../core/index.ts";
import type { OutputPlacement, OutputPlan, Roster } from "../core/index.ts";

export interface OutputProject {
  /** 项目根：正本身份与落点都相对它 */
  root: string;
  /** 正本 → 落点；用 core 的 placementsOf 从配置归一 */
  outputs: Record<string, OutputPlacement[]>;
  roster: Roster;
  /** 正本里的钉在这个项目里核对：通常是 code-pin 的 createDiskPinner(root) */
  pinner: Pinner;
}

/** render 对一个落点做了什么：placed 写了（内容有变）；unchanged 已经是这一份；no-frontmatter / unrenderable 没写 */
export interface OutputWrite {
  doc: string;
  to: string;
  status: "placed" | "unchanged" | "no-frontmatter" | "unrenderable";
  missing?: string[];
  reason?: string;
}

/** verify 看到的一个落点：只有 fresh 算新鲜；missing 生成物还不在；stale 跟正本不一致 */
export interface OutputCheck {
  doc: string;
  to: string;
  status: "fresh" | "missing" | "stale" | "no-frontmatter" | "unrenderable";
  fresh: boolean;
  missing?: string[];
  reason?: string;
}

function plansOf(project: OutputProject, doc: string): OutputPlan[] {
  const placements = project.outputs[doc];
  if (placements === undefined) throw new Error(`${doc} 不在 outputs 映射里`);
  const source = readFileSync(join(project.root, doc), "utf8");
  return planOutputs(source, placements, { roster: project.roster, checkPins: (pins) => project.pinner.check(pins) });
}

const readPlaced = (root: string, to: string): string | null => {
  const path = join(root, to);
  return existsSync(path) ? readFileSync(path, "utf8") : null;
};

/** 摆放：每篇正本渲染一次，内容有变的落点才写；缺字段、渲染不了的落点不写 */
export function renderOutputs(project: OutputProject, docs: string[] = Object.keys(project.outputs)): OutputWrite[] {
  return docs.flatMap((doc) =>
    plansOf(project, doc).map((plan): OutputWrite => {
      if ("problem" in plan) return plan.problem === "no-frontmatter" ? { doc, to: plan.to, status: plan.problem, missing: plan.missing } : { doc, to: plan.to, status: plan.problem, reason: plan.reason };
      const placed = readPlaced(project.root, plan.to);
      if (placed !== null && sameOutput(placed, plan.text)) return { doc, to: plan.to, status: "unchanged" };
      const path = join(project.root, plan.to);
      mkdirSync(dirname(path), { recursive: true });
      writeFileSync(path, plan.text);
      return { doc, to: plan.to, status: "placed" };
    }),
  );
}

/** 核对：只读不写，交回每个落点的状态 */
export function verifyOutputs(project: OutputProject, docs: string[] = Object.keys(project.outputs)): OutputCheck[] {
  return docs.flatMap((doc) =>
    plansOf(project, doc).map((plan): OutputCheck => {
      if ("problem" in plan) {
        return plan.problem === "no-frontmatter"
          ? { doc, to: plan.to, status: plan.problem, fresh: false, missing: plan.missing }
          : { doc, to: plan.to, status: plan.problem, fresh: false, reason: plan.reason };
      }
      const placed = readPlaced(project.root, plan.to);
      if (placed === null) return { doc, to: plan.to, status: "missing", fresh: false };
      const fresh = sameOutput(placed, plan.text);
      return { doc, to: plan.to, status: fresh ? "fresh" : "stale", fresh };
    }),
  );
}

/** 落点的地盘规则：相对项目根、不落进正本所在的目录（sourceDirs，相对项目根）、一个落点只许一篇正本写 */
export function assertOutputTurf(root: string, sourceDirs: string[], outputs: Record<string, OutputPlacement[]>): void {
  const claimed = new Map<string, string>();
  for (const [doc, targets] of Object.entries(outputs)) {
    for (const { to } of targets) {
      if (isAbsolute(to)) throw new Error(`outputs 的 ${doc} → ${to}：落点得相对项目根，绝对路径不认`);
      const rel = relative(root, resolve(root, to));
      for (const dir of sourceDirs) {
        const relSource = relative(root, resolve(root, dir));
        if (rel === relSource || rel.startsWith(relSource + sep)) throw new Error(`outputs 的 ${doc} → ${to}：落点落进了 ${dir}，那是正本的地盘`);
      }
      const owner = claimed.get(to);
      if (owner !== undefined) throw new Error(`outputs 的 ${owner} 和 ${doc} 都往 ${to} 写——一个落点只许一篇正本写`);
      claimed.set(to, doc);
    }
  }
}
