/**
 * fumadocs 接线。三样东西：
 *   docfirstMdxOptions({ root })   给 source.config 的 mdxOptions：remark 链尾巴挂插件 + meta 白名单
 *   parseMetaString               fumadocs 的 rehypeCode 只放行白名单里的 meta，把状态点的颜色 data-dot 加进去
 *   remarkDocfirstHost({ root })   异步 attacher：站构建时 loader 并发调，项目只装配一次
 * 插件挂在链尾：前面是 fumadocs 的 remarkInclude 和预设（标题 id、gfm……），后面就是它自己的 postprocess。
 */
import { loadProject } from "../host/index.ts";
import { remarkGlossary } from "./glossary-plugin.ts";
import type { GlossaryOptions } from "./glossary-plugin.ts";
import { remarkDocfirst } from "./remark-plugin.ts";
import type { PluginFile } from "./remark-plugin.ts";
import type { Roster } from "./roster.ts";
import type { TreeNode } from "./tree.ts";

export function remarkDocfirstHost({ root }: { root: string }): (tree: TreeNode, file: PluginFile) => Promise<void> {
  let inner: ((tree: TreeNode, file: PluginFile) => void) | null = null;
  return async (tree, file) => {
    const project = await loadProject(root);
    inner ??= remarkDocfirst({
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

/**
 * 站的 source.config.ts 里 `mdxOptions: docfirstMdxOptions({ root: process.cwd() })` 一行接上。
 *
 * 给了 `glossary` 就顺带开术语自动标注。**它挂在 docfirst 那个插件之前**：那时树上还只有
 * 作者写的散文，引用投影的代码块与目录树都还没注入，标注碰不到它们。不给就是原来的行为，
 * 一个字节都不变——已经在跑的站不用跟着升级。
 */
export function docfirstMdxOptions({ root, glossary }: { root: string; glossary?: GlossaryOptions }): {
  remarkPlugins: (v: unknown[]) => unknown[];
  rehypeCodeOptions: { parseMetaString: typeof parseMetaString };
} {
  return {
    remarkPlugins: (v: unknown[]) =>
      glossary === undefined
        ? [...v, [remarkDocfirstHost, { root }]]
        : [...v, [remarkGlossary, glossary], [remarkDocfirstHost, { root }]],
    rehypeCodeOptions: { parseMetaString },
  };
}
