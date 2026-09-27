/**
 * remark 插件：挂在 fumadocs 的 remark 链尾巴上。认引用 → 钉码编排算清单 → 树上换节点 → 按名册打标。
 * 调用方提供三样：钉码编排（从项目装配来）、由 vfile 算文档身份的函数、名册（不给就用 fumadocsRoster）。
 */
import type { Listing, Reference } from "@godcreator/docfirst-workflow";
import { recognize, stamp } from "@godcreator/docfirst-workflow/mdx";
import type { Roster, TreeNode } from "@godcreator/docfirst-workflow/mdx";
import { fumadocsRoster } from "./roster.ts";
import { applyListing } from "./transform.ts";

export interface PluginFile {
  path?: string;
}

export interface RemarkOptions {
  pinning: { checkReferences(doc: string, references: Reference[]): Listing };
  docOf(file: PluginFile): string;
  roster?: Roster;
}

export function remarkDocfirst({ pinning, docOf, roster = fumadocsRoster }: RemarkOptions): (tree: TreeNode, file: PluginFile) => void {
  return (tree, file) => {
    const listing = pinning.checkReferences(docOf(file), recognize(tree));
    applyListing(tree, listing);
    stamp(tree, roster);
  };
}
