/**
 * confirm：逐篇机械写回，再把全部生成正本重新生成一遍（内容变了才写）。
 *
 * 带路径是按页限定，只动点名的那几篇：同一个仓里别人的黄灯还等着他复核，一并确认掉就是替别人做了复核。
 * `--accept` 确认的就是黄灯，必须点名页。重新生成不按页限定：生成物要不要跟着更新按内容判断。
 */
import type { Project } from "../project.ts";
import { confirmStepLine } from "../text.ts";
import { writeOutputs } from "./render.ts";

/** 点名的路径换成文档身份；三种路径写法都收，对不上现状区的一并交回，不静默跳过 */
export function pickDocs(project: Project, named: readonly string[]): { docs: string[] } | { unknown: string[] } {
  const alive = new Set(project.docs);
  const picked: string[] = [];
  const unknown: string[] = [];
  for (const raw of named) {
    const doc = project.docIdOf(raw);
    if (alive.has(doc)) picked.push(doc);
    else unknown.push(raw);
  }
  return unknown.length > 0 ? { unknown } : { docs: [...new Set(picked)] };
}

/** 一篇的机械写回：逐处打印一行，返回这篇钉不住的处数（红） */
function confirmDoc(project: Project, doc: string, accept: boolean): number {
  let red = 0;
  for (const step of project.pins.confirm(doc, { accept }).steps) {
    const line = confirmStepLine(doc, step);
    if (line !== null) console.log(line);
    if (step.action === "refused") red += 1;
  }
  return red;
}

export function confirmCommand(project: Project, named: readonly string[], accept: boolean): number {
  if (accept && named.length === 0) {
    console.error("--accept 要点名页：docfirst confirm <文档路径…> --accept——确认黄灯得说清是哪几页，什么都没动");
    return 2;
  }
  let pages = project.docs;
  if (named.length > 0) {
    const picked = pickDocs(project, named);
    if ("unknown" in picked) {
      console.error(`不是这个项目里的文档：${picked.unknown.join("、")}——什么都没动`);
      return 2;
    }
    pages = picked.docs;
    console.log(`·  按页限定：只动 ${pages.join("、")}，别的页不碰`);
  }
  let red = 0;
  for (const doc of pages) red += confirmDoc(project, doc, accept);
  red += writeOutputs(project, "confirm");
  return red > 0 ? 1 : 0;
}
