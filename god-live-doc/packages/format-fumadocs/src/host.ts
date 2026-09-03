/**
 * fumadocs 接线。三样东西：
 *   livedocMdxOptions({ root })   给 source.config 的 mdxOptions：remark 链尾巴挂插件 + meta 白名单
 *   parseMetaString               fumadocs 的 rehypeCode 只放行白名单里的 meta，把状态点的颜色 data-dot 加进去
 *   remarkLivedocHost({ root })   异步 attacher：站构建时 loader 并发调，项目只装配一次
 * 插件挂在链尾：前面是 fumadocs 的 remarkInclude 和预设（标题 id、gfm……），后面就是它自己的 postprocess。
 */
import { loadProject } from "@god-live-doc/project";
import { remarkLivedoc } from "./remark-plugin.ts";
import type { PluginFile } from "./remark-plugin.ts";
import type { Roster } from "./roster.ts";
import type { TreeNode } from "./tree.ts";

export function remarkLivedocHost({ root }: { root: string }): (tree: TreeNode, file: PluginFile) => Promise<void> {
  let inner: ((tree: TreeNode, file: PluginFile) => void) | null = null;
  return async (tree, file) => {
    const project = await loadProject(root);
    inner ??= remarkLivedoc({
      service: project.service,
      docOf: (f) => project.docIdOf(f.path ?? ""),
      ...(project.roster !== undefined ? { roster: project.roster as Roster } : {}),
    });
    inner(tree, file);
  };
}

const ALLOWED = new Set(["title", "tab", "noCopy", "lineNumbers", "data-dot", "data-chip"]);

/** meta 字符串 → 属性表。只放行白名单；跟 fumadocs 默认白名单同形，多认 data-dot（状态点的颜色）和 data-chip（芯片） */
export function parseMetaString(meta: string): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const m of meta.matchAll(/([\w-]+)(?:=(?:"([^"]*)"|(\d+)))?/g)) {
    const [, key, str, num] = m;
    if (key === undefined || !ALLOWED.has(key)) continue;
    if (key === "noCopy") out.allowCopy = "false";
    else if (key === "lineNumbers") {
      out["data-line-numbers"] = true;
      if (num !== undefined) out["data-line-numbers-start"] = Number(num);
    } else out[key] = str ?? true;
  }
  return out;
}

/** 站的 source.config.ts 里 `mdxOptions: livedocMdxOptions({ root: process.cwd() })` 一行接上 */
export function livedocMdxOptions({ root }: { root: string }): {
  remarkPlugins: (v: unknown[]) => unknown[];
  rehypeCodeOptions: { parseMetaString: typeof parseMetaString };
} {
  return {
    remarkPlugins: (v: unknown[]) => [...v, [remarkLivedocHost, { root }]],
    rehypeCodeOptions: { parseMetaString },
  };
}
