/**
 * 正本渲染成 Markdown，只有一条管线：remark 解析 → 裸写的网址换回原文 → 钉码标记换成 codePin 节点（code-pin 的 core）→
 * 查出渲染不了的地方 → remark-stringify 加 `machineTextHandlers` 写出 Markdown。
 *
 * handlers 不改树：codePin 写成一块代码，名册里的组件写成它的机读节点，frontmatter 不写。
 * 站点要给每页出机读版时，同一组 handlers 可以交给站点自己的序列化。
 */
import { exportCodeOf, lineOf, REASON_TEXT, replacePinMarkers } from "@godcreator/code-pin";
import type { CheckPins, CodePin } from "@godcreator/code-pin";
import type { Root, RootContent } from "mdast";
import type { Handle, Options as StringifyOptions } from "mdast-util-to-markdown";
import remarkFrontmatter from "remark-frontmatter";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import remarkMdx from "remark-mdx";
import remarkParse from "remark-parse";
import remarkStringify from "remark-stringify";
import { unified } from "unified";
import { SKIP, visit } from "unist-util-visit";
import { isComponent, machineNodesOf } from "./roster.ts";
import type { Component, Roster } from "./roster.ts";

/** 正本里有渲染不了的东西（没确认或缺失的钉、名册外组件、mdx 表达式、import / export）时抛它，原因一次列全 */
export class RenderRefusal extends Error {
  override name = "RenderRefusal";
}

export interface MachineTextOptions {
  roster: Roster;
  /** 钉在哪个项目里核对：通常是 code-pin 的 `createDiskPinner(项目根).check` */
  checkPins: CheckPins;
}

/** 写出 Markdown 的口径：列表用 `-`，与正本的写法一致 */
const STRINGIFY_OPTIONS: StringifyOptions = { bullet: "-", emphasis: "*", strong: "*", fence: "`", fences: true, rule: "-", listItemIndent: "one" };

/** 生成物里写不了的钉：没确认的、缺失的；能写给 null */
function pinProblem(pin: CodePin): string | null {
  const { check } = pin;
  const line = check.pin.line;
  if (check.pin.record === null) return `第 ${line} 行的钉还没确认，先确认再生成`;
  if (check.status !== "missing") return null;
  if (check.reason === undefined || check.reason === "changed") throw new Error(`第 ${line} 行：缺失的钉没带缺失理由（${check.reason}）`);
  return `第 ${line} 行的钉缺失（${REASON_TEXT[check.reason]}），先修好`;
}

/**
 * 正文里裸写的网址（GFM 自动链接：没有方括号也没有尖括号）换回原文那一段，照原样写出。
 * 解析出的 link 节点不记得自己是裸写的，写回会变成 `[网址](网址)`；GFM 认网址结尾只看空白与 ASCII 标点，
 * 后面紧跟的全角标点与汉字也算进网址，写成链接就把后文一起包进去。换成 html 节点是因为写出时它的 value 原样输出、不转义
 */
function keepBareUrlsAsWritten(tree: Root, source: string): void {
  visit(tree, "link", (node, index, parent) => {
    const start = node.position?.start.offset;
    const end = node.position?.end.offset;
    if (start === undefined || end === undefined || parent === undefined || index === undefined) return undefined;
    if (source[start] === "[" || source[start] === "<") return SKIP;
    parent.children[index] = { type: "html", value: source.slice(start, end) };
    return SKIP;
  });
}

const placeOf = (node: RootContent): string => (node.position === undefined ? "规则交回的节点里" : `第 ${lineOf(node)} 行`);

/** 一个名册里的组件换成机读节点之后，里面还渲染不了的地方：规则出错、嵌着的名册外组件、写不了的钉 */
function componentProblems(node: Component, roster: Roster): string[] {
  let nodes: RootContent[];
  try {
    nodes = machineNodesOf(node, roster);
  } catch (err) {
    return [(err as Error).message];
  }
  const problems: string[] = [];
  visit({ type: "root", children: nodes } as Root, (inner) => {
    if (inner.type === "codePin") {
      const problem = pinProblem(inner);
      if (problem !== null) problems.push(problem);
      return SKIP;
    }
    if (!isComponent(inner)) return undefined;
    if (roster[inner.name ?? ""] === undefined) problems.push(`${placeOf(inner)}：名册外组件 <${inner.name}>`);
    else problems.push(...componentProblems(inner, roster));
    return SKIP;
  });
  return problems;
}

/** 正本里渲染不了的地方，一处一句；钉码标记已经换成 codePin */
export function refusalsOf(tree: Root, roster: Roster): string[] {
  const refusals: string[] = [];
  visit(tree, (node) => {
    switch (node.type) {
      case "codePin": {
        const problem = pinProblem(node);
        if (problem !== null) refusals.push(problem);
        return SKIP;
      }
      case "mdxFlowExpression":
      case "mdxTextExpression":
        refusals.push(`第 ${lineOf(node)} 行有 mdx 表达式 {${node.value.trim()}}，生成物只写 Markdown`);
        return SKIP;
      case "mdxjsEsm":
        refusals.push(`第 ${lineOf(node)} 行有 import / export，生成物只写 Markdown`);
        return SKIP;
      case "mdxJsxFlowElement":
      case "mdxJsxTextElement": {
        const where = `第 ${lineOf(node)} 行`;
        if (roster[node.name ?? ""] === undefined) refusals.push(`${where}有名册外组件 <${node.name}>，先在名册里给它写机读规则`);
        else {
          const problems = componentProblems(node, roster);
          if (problems.length > 0) refusals.push(`${where}的组件 <${node.name}> 换不成机读文字：${problems.join("；")}`);
        }
        return SKIP;
      }
      default:
        return undefined;
    }
  });
  return refusals;
}

/** remark-stringify 的 handlers：codePin 写成一块代码，名册里的组件写成它的机读节点，frontmatter 不写 */
export function machineTextHandlers(roster: Roster): Record<"codePin" | "mdxJsxFlowElement" | "mdxJsxTextElement" | "yaml", Handle> {
  return {
    codePin: (node: CodePin, parent, state, info) => state.handle(exportCodeOf(node.check), parent, state, info),
    mdxJsxFlowElement: (node: Component, _parent, state, info) => state.containerFlow({ type: "root", children: machineNodesOf(node, roster) }, info),
    mdxJsxTextElement: (node: Component, _parent, state, info) =>
      state.containerPhrasing({ type: "paragraph", children: machineNodesOf(node, roster) as never }, info),
    yaml: () => "",
  };
}

/**
 * 正本渲染成生成物的正文：去掉 frontmatter，钉码标记写成带语言与 `title="路径:起-止"` 的代码块，
 * 组件写成名册里它的机读文字，裸写的网址照原文，开头的空行去掉。换行先统一成 LF。渲染不了的一次列全、抛 RenderRefusal
 */
export function renderMachineMarkdown(source: string, { roster, checkPins }: MachineTextOptions): string {
  const processor = unified()
    .use(remarkParse)
    // 每格都按宽 3 算：分隔行写成正本里的 `| --- |`，单元格不补空格对齐
    .use(remarkGfm, { stringLength: () => 3 })
    .use(remarkFrontmatter)
    .use(remarkMath)
    .use(remarkMdx)
    .use(remarkStringify, { ...STRINGIFY_OPTIONS, handlers: machineTextHandlers(roster) });
  const normalized = source.replace(/\r\n/g, "\n");
  const tree = processor.parse(normalized);
  keepBareUrlsAsWritten(tree, normalized);
  replacePinMarkers(tree, checkPins);
  const refusals = refusalsOf(tree, roster);
  if (refusals.length > 0) throw new RenderRefusal(refusals.join("；"));
  return processor.stringify(tree).replace(/^\n+/, "");
}
