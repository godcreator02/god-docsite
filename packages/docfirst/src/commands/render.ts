/**
 * render：生成正本按 outputs 生成到落点，内容变了才写；confirm 最后也走这里重新生成一遍。
 */
import { renderOutputs } from "@godcreator/doc-export/node";
import type { Project } from "../project.ts";
import { unwrittenOutputLine } from "../text.ts";

/** 现状区里的生成正本，按文档身份排序 */
const outputSourcesOf = (project: Project): string[] => project.docs.filter(project.isOutputSource);

/** 写一遍全部生成物、逐个落点打印一行，返回没生成成功的落点数；command 是报错里让人改好之后再运行的那条命令 */
export function writeOutputs(project: Project, command: "render" | "confirm"): number {
  let red = 0;
  for (const written of renderOutputs(project.outputs, outputSourcesOf(project))) {
    const { doc, to, status } = written;
    if (status === "no-frontmatter" || status === "unrenderable") {
      console.log(unwrittenOutputLine(doc, written, command));
      red += 1;
    } else if (status === "placed") {
      console.log(command === "render" ? `→  ${doc}  摆放到 ${to}` : `→  ${doc}  重新摆放到 ${to}`);
    } else if (command === "render") {
      console.log(`·  ${doc} → ${to}  没变`);
    }
  }
  return red;
}

export function renderCommand(project: Project): number {
  return writeOutputs(project, "render") > 0 ? 1 : 0;
}
