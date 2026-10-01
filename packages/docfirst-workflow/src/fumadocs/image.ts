/**
 * Markdown 图片的机读文字。fumadocs 预设里的 remarkImage 排在 docfirst 插件之前，它把 `![说明](/p2/x.png)` 换成
 * `<img alt="说明" src={__img0} />`，再在文件开头注入 `import __img0 from "<相对页面的路径>"`。这个 `<img>` 不是作者写的组件，
 * 不进名册：在按名册标机读文字之前给它挂上 `![说明](原地址)`，stamp 见到已有机读文字就跳过它。
 *
 * 认的是 remarkImage 的产物：名字是 img、没有 position（生成的节点不带位置；作者手写的 `<img>` 带位置，照旧走名册）、
 * src 是一个默认 import 进来的变量。原地址从 import 路径还原：落在站的 public/ 下就写成站内绝对路径，否则写 import 路径。
 */
import { dirname, isAbsolute, relative, resolve, sep } from "node:path";
import { walk } from "@godcreator/docfirst-workflow/mdx";
import type { JsxAttribute, TreeNode } from "@godcreator/docfirst-workflow/mdx";

/** mdast 的图片节点，交给 fumadocs 的序列化写成 `![alt](url "title")` */
interface ImageNode extends TreeNode {
  type: "image";
  url: string;
  alt: string;
  title: string | null;
}

/** mdxjsEsm 节点上 estree 里用到的那几层 */
interface EsmData {
  estree?: {
    body?: Array<{
      type: string;
      source?: { value?: unknown };
      specifiers?: Array<{ type: string; local?: { name?: string } }>;
    }>;
  };
}

/** 文件顶层的默认 import：变量名 → import 路径 */
function defaultImportsOf(tree: TreeNode): Map<string, string> {
  const out = new Map<string, string>();
  for (const node of tree.children ?? []) {
    if (node.type !== "mdxjsEsm") continue;
    for (const statement of (node.data as EsmData | undefined)?.estree?.body ?? []) {
      if (statement.type !== "ImportDeclaration" || typeof statement.source?.value !== "string") continue;
      for (const specifier of statement.specifiers ?? []) {
        const name = specifier.local?.name;
        if (specifier.type === "ImportDefaultSpecifier" && name !== undefined) out.set(name, statement.source.value);
      }
    }
  }
  return out;
}

function attributeOf(node: TreeNode, name: string): JsxAttribute | undefined {
  return node.attributes?.find((a) => a.type === "mdxJsxAttribute" && a.name === name);
}

function stringAttributeOf(node: TreeNode, name: string): string | null {
  const value = attributeOf(node, name)?.value;
  return typeof value === "string" ? value : null;
}

/** remarkImage 生成的 `<img>` 的 src 指向的 import 路径；不是它生成的就是 undefined */
function importedSrcOf(node: TreeNode, importedPaths: Map<string, string>): string | undefined {
  if (node.type !== "mdxJsxFlowElement" || node.name !== "img" || node.position !== undefined) return undefined;
  const src = attributeOf(node, "src")?.value;
  if (src === null || typeof src !== "object" || src.value === undefined) return undefined;
  return importedPaths.get(src.value);
}

/** import 路径还原成作者写的地址：public/ 下的文件写成 `/p2/x.png`，别的原样 */
function urlOf(importPath: string, page: string, publicDir: string): string {
  const inPublic = relative(publicDir, resolve(dirname(page), importPath));
  if (inPublic.startsWith("..") || isAbsolute(inPublic)) return importPath;
  return `/${inPublic.split(sep).join("/")}`;
}

/** 给 remarkImage 生成的每个 `<img>` 挂上机读文字；page 是这一页的文件路径，publicDir 是 remarkImage 用的那个 public 目录 */
export function markMarkdownImages(tree: TreeNode, { page, publicDir }: { page: string; publicDir: string }): void {
  const importedPaths = defaultImportsOf(tree);
  if (importedPaths.size === 0) return;
  walk(tree, (node) => {
    const importPath = importedSrcOf(node, importedPaths);
    if (importPath === undefined) return;
    const image: ImageNode = {
      type: "image",
      url: urlOf(importPath, page, publicDir),
      alt: stringAttributeOf(node, "alt") ?? "",
      title: stringAttributeOf(node, "title"),
    };
    node.data ??= {};
    node.data.docfirstAi = [image];
  });
}
