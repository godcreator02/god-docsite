/**
 * remark 插件：挂在 fumadocs 的 remark 链尾巴上。认引用 → 核心算清单 → 树上换节点 → 按名册打标。
 * 调用方提供三样：核心服务（从项目装配来）、由 vfile 算文档身份的函数、名册。
 */
import type { Reference, Listing } from "@godcreator02/live-doc-core";
import { recognize } from "./recognize.ts";
import { applyListing } from "./transform.ts";
import { defaultRoster, stamp } from "./roster.ts";
import type { Roster } from "./roster.ts";
import type { TreeNode } from "./tree.ts";

export interface PluginFile {
  path?: string;
}

export interface RemarkOptions {
  service: { resolveRefs(doc: string, references: Reference[]): Listing };
  docOf(file: PluginFile): string;
  roster?: Roster;
}

export function remarkLivedoc({ service, docOf, roster = defaultRoster }: RemarkOptions): (tree: TreeNode, file: PluginFile) => void {
  return (tree, file) => {
    const listing = service.resolveRefs(docOf(file), recognize(tree));
    applyListing(tree, listing);
    stamp(tree, roster);
  };
}
