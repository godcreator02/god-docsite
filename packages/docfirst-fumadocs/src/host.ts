/**
 * fumadocs 接线。三样东西：
 *   docfirstMdxOptions({ root })   现状集合的 mdxOptions，交给 fumadocs-mdx 的 applyMdxPreset：remark 链末尾加上插件 + meta 白名单
 *   parseMetaString               fumadocs 的 rehypeCode 只放行白名单里的 meta，把状态点的颜色 data-dot 加进去
 *   remarkDocfirstHost({ root })   异步 attacher：站构建时 loader 并发调，项目只装配一次
 * 插件加在链末尾：前面是 fumadocs 的 remarkInclude 和预设（标题 id、gfm……），后面就是它自己的 postprocess。
 */
import type { Pluggable } from "unified";
import { loadProject } from "@godcreator/docfirst-workflow";
import type { Roster, TreeNode } from "@godcreator/docfirst-workflow/mdx";
import { remarkGlossary } from "./glossary-plugin.ts";
import type { GlossaryOptions } from "./glossary-plugin.ts";
import { remarkDocfirst } from "./remark-plugin.ts";
import type { PluginFile } from "./remark-plugin.ts";

export function remarkDocfirstHost({ root }: { root: string }): (tree: TreeNode, file: PluginFile) => Promise<void> {
  let inner: ((tree: TreeNode, file: PluginFile) => void) | null = null;
  return async (tree, file) => {
    const project = await loadProject(root);
    inner ??= remarkDocfirst({
      pinning: project.pinning,
      docOf: (f) => project.docIdOf(f.path ?? ""),
      ...(project.roster !== undefined ? { roster: project.roster as Roster } : {}),
    });
    inner(tree, file);
  };
}

const ALLOWED = new Set(["title", "tab", "noCopy", "lineNumbers", "data-dot"]);

/** meta 字符串 → 属性表。只放行白名单；跟 fumadocs 默认白名单同形，多认 data-dot（状态点的颜色） */
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
 * `docfirstMdxOptions` 的返回值，形状对得上 fumadocs-mdx 的 `applyMdxPreset` 的参数（类型里不 import fumadocs，
 * 按结构对上）。`themes` 是 fumadocs 的默认值：fumadocs 的类型要求 theme / themes 二选一必填，
 * 运行时它先铺默认再盖这份，写上默认值结果不变。
 */
export interface DocfirstMdxOptions {
  remarkPlugins: (v: Pluggable[]) => Pluggable[];
  rehypeCodeOptions: {
    themes: { light: string; dark: string };
    parseMetaString: typeof parseMetaString;
  };
}

/**
 * 站的 `src/lib/source.ts` 里，现状集合写 `mdxOptions: applyMdxPreset(docfirstMdxOptions({ root: process.cwd() }))`。
 * 集合级 mdxOptions 会去掉 fumadocs 的全部默认插件，`applyMdxPreset` 把它们加回来。
 *
 * 给了 `glossary` 就顺带开术语自动标注。**它排在 docfirst 那个插件之前**：那时树上还只有
 * 作者写的散文，引用投影的代码块与目录树都还没注入，标注碰不到它们。
 */
export function docfirstMdxOptions({ root, glossary }: { root: string; glossary?: GlossaryOptions }): DocfirstMdxOptions {
  return {
    remarkPlugins: (v) =>
      glossary === undefined
        ? [...v, [remarkDocfirstHost, { root }]]
        : [...v, [remarkGlossary, glossary], [remarkDocfirstHost, { root }]],
    rehypeCodeOptions: { themes: { light: "github-light", dark: "github-dark" }, parseMetaString },
  };
}
