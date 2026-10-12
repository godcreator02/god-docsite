/**
 * `./content`：构建页面时 fumadocs-mdx 对站里每一份 MDX 调用的 remark 插件。项目根是站点目录（构建与开发服务都在那里运行），
 * 按 docfirst.config.mjs 装配项目，再按文件所在的区决定做什么：
 *   现状区（内容根下除 future/ 之外）  术语标注（配置里有 glossary 时）→ 钉码投影 → 钉码代码块包上状态点的外层
 *   未来区 content/future/              不处理
 *   轨迹卡目录（配置的 trajectory）     卡正文里的关系行与卡链接
 *   别的（评论）                        不处理
 */
import { join, relative } from "node:path";
import { pathToFileURL } from "node:url";
import type { FeatureContent } from "@godcreator/docsite-kit/feature";
import { loadProject } from "@godcreator/docfirst-workflow";
import type { GlossaryConfig, Project } from "@godcreator/docfirst-workflow";
import { remarkDocfirstHost, remarkGlossary, remarkTrajectoryLinks } from "@godcreator/docfirst-workflow/fumadocs";
import type { PluginFile, Root, TermEntry } from "@godcreator/docfirst-workflow/fumadocs";
import type { TreeNode } from "@godcreator/docfirst-workflow/mdx";
import { framePinnedCode } from "./pin-frame.ts";
import { trajectoryHrefBase } from "./trajectory-href.ts";

type Transform = (tree: TreeNode, file: PluginFile) => void | Promise<void>;

interface SiteTransforms {
  project: Project;
  statusArea: Transform[];
  trajectory: Transform[];
}

/** 术语表模块：配置 glossary.terms 指的那个文件，导出 terms */
async function termsOf(root: string, glossary: GlossaryConfig): Promise<TermEntry[]> {
  const module = (await import(pathToFileURL(join(root, glossary.terms)).href)) as { terms?: unknown };
  if (!Array.isArray(module.terms)) throw new Error(`术语表 ${glossary.terms} 要导出数组 terms`);
  return module.terms as TermEntry[];
}

async function siteTransformsOf(root: string): Promise<SiteTransforms> {
  const project = await loadProject(root);
  const glossary = project.config.glossary;
  const skippedDocs = new Set(glossary?.skip ?? []);
  const glossaryTransforms: Transform[] =
    glossary === undefined ? [] : [remarkGlossary({ terms: await termsOf(root, glossary), skipFile: (path) => skippedDocs.has(project.docIdOf(path)) })];
  const pinFrame: Transform = (tree) => framePinnedCode(tree);
  const trajectoryLinks = remarkTrajectoryLinks({ hrefBase: trajectoryHrefBase });
  return {
    project,
    statusArea: [...glossaryTransforms, remarkDocfirstHost({ root }), pinFrame],
    trajectory: [(tree) => trajectoryLinks(tree as Root)],
  };
}

const isInside = (dir: string, path: string): boolean => !relative(dir, path).startsWith("..");

function transformsFor({ project, statusArea, trajectory }: SiteTransforms, path: string): Transform[] {
  if (isInside(project.trajectoryDir, path)) return trajectory;
  const contentDir = join(project.root, project.contentDir);
  if (!isInside(contentDir, path) || isInside(join(contentDir, "future"), path)) return [];
  return statusArea;
}

function remarkDocfirstSite(): Transform {
  let loading: Promise<SiteTransforms> | undefined;
  return async (tree, file) => {
    if (file.path === undefined) throw new Error("remark 插件拿到的文件没有路径：fumadocs-mdx 编译每一份 MDX 都带着 path");
    const transforms = await (loading ??= siteTransformsOf(process.cwd()));
    for (const transform of transformsFor(transforms, file.path)) await transform(tree, file);
  };
}

const content: FeatureContent = { remarkPlugins: [remarkDocfirstSite] };
export default content;
