/**
 * remark 插件：加在 fumadocs 的 remark 链末尾。认引用 → 钉码编排算清单 → 树上换节点 → 按名册标上机读文字。
 * 调用方提供三样：钉码编排（从项目装配来）、由 vfile 算文档身份的函数、名册（项目上的那份）。
 */
import type { Listing, Reference } from "@godcreator/docfirst-workflow";
import { recognize, stamp } from "@godcreator/docfirst-workflow/mdx";
import type { Roster, TreeNode } from "@godcreator/docfirst-workflow/mdx";
import { applyListing } from "./transform.ts";

export interface PluginFile {
  path?: string;
}

/** vfile 的路径；fumadocs 编译每一页都带着它，拿不到就是调用方的错，直接报错 */
export function pathOf(file: PluginFile): string {
  if (file.path === undefined) throw new Error("remark 插件拿到的文件没有路径——站构建时每一页都应该带着 path");
  return file.path;
}

export interface RemarkOptions {
  pinning: { checkReferences(doc: string, references: Reference[]): Listing };
  docOf(file: PluginFile): string;
  roster: Roster;
}

export function remarkDocfirst({ pinning, docOf, roster }: RemarkOptions): (tree: TreeNode, file: PluginFile) => void {
  return (tree, file) => {
    const listing = pinning.checkReferences(docOf(file), recognize(tree));
    applyListing(tree, listing);
    stamp(tree, roster);
  };
}
