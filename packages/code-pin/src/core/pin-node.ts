/**
 * 语法树上的钉：`replacePinMarkers` 认出树上的标记、一次核对完，把每个标记节点换成一个 `codePin` 节点，
 * 核对结果挂在节点上。站点与生成物各自决定 `codePin` 长什么样：站点给它子节点与 hast 属性，生成物把它写成一块代码。
 */
import type { Code, Data, Parent, Root, RootContent } from "mdast";
import type { DocPin } from "./doc-pins.ts";
import { langOf } from "./lang.ts";
import { findMarkers } from "./mdx.ts";
import type { MarkerPlace } from "./mdx.ts";
import type { PinCheck } from "./types.ts";

export interface CodePinData extends Data {
  hName?: string;
  hProperties?: Record<string, string | string[]>;
}

/** 标记换成的节点：核对结果挂在 `check` 上，位置照抄标记的 */
export interface CodePin extends Parent {
  type: "codePin";
  check: PinCheck<DocPin>;
  children: RootContent[];
  data?: CodePinData;
}

declare module "mdast" {
  interface RootContentMap {
    codePin: CodePin;
  }
  interface BlockContentMap {
    codePin: CodePin;
  }
}

/** 核对一组钉：通常是 `Pinner.check`；站点与生成物各自决定钉在哪个项目里核对 */
export type CheckPins = (pins: DocPin[]) => PinCheck<DocPin>[];

/** 把树上的标记全换成 `codePin` 节点，交回换上的节点（按在文档里的先后）。结果按钉对象配回各自的标记 */
export function replacePinMarkers(tree: Root, checkPins: CheckPins): CodePin[] {
  const places = new Map<DocPin, MarkerPlace>(findMarkers(tree).map((place) => [place.pin, place]));
  if (places.size === 0) return [];
  return checkPins([...places.keys()]).map((check) => {
    const place = places.get(check.pin);
    if (place === undefined) throw new Error(`核对结果里的钉不是从这棵树上认出来的（第 ${check.pin.line} 行）`);
    const node: CodePin = { type: "codePin", check, children: [], ...(place.node.position !== undefined ? { position: place.node.position } : {}) };
    place.parent.children[place.index] = node;
    return node;
  });
}

/**
 * 生成物里这一处的标题：行段 `路径:起-止`（今天的位置），整文件 `路径:1-行数`，目录树 `目录/`（带 glob）
 */
export function exportTitleOf(check: PinCheck): string {
  const target = check.pin.target;
  if (target.kind === "tree") return `${target.dir}/${target.glob !== undefined ? ` ${target.glob}` : ""}`;
  return `${target.file}:${check.lines[0]}-${check.lines[1]}`;
}

/** 生成物里这一处写成的代码块：语言加 `title="…"`，内容是今天的那几行（目录树是名字表） */
export function exportCodeOf(check: PinCheck): Code {
  const target = check.pin.target;
  const lang = target.kind === "tree" ? "text" : langOf(target.file) || "text";
  return { type: "code", lang, meta: `title="${exportTitleOf(check)}"`, value: (check.current ?? []).join("\n") };
}
