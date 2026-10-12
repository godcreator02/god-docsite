/**
 * docfirst 站的建站输入：把 docfirst 的结构模板渲染好，连同依赖与脚本，组成交给 `createSite`（`scaffold.ts`）的选项。
 * `createSite` 先运行官方脚手架 create-fumadocs-app、应用本机约定，再按这里给的清单新增、替换、删除、改文件。
 * 不碰盘：模板正文、仓根 package.json 都由调用方读好传入。
 *
 * 模板假设站在仓根下一层（约定叫 `docs-site/`）：outputs 映射把 README / AGENTS / CLAUDE 生成到 `../`。
 */
import { dirname } from "node:path";
import { DOCFIRST_DEPS } from "./deps.js";
import type { RepoManifest } from "./repo-root.js";
import type { FileEdit, SiteFile, SiteOptions } from "./scaffold.js";
import { renderFiles, type SiteTemplate, type TemplateFile } from "./template.js";
import { valuesFor } from "./values.js";

/** docfirst 站比普通站多出来的脚本 */
export const DOC_SCRIPTS: Record<string, string> = {
  docfirst: "docfirst",
  doc: "docfirst check",
  "doc:confirm": "docfirst confirm",
  "doc:render": "docfirst render",
  "verify:roster": "node scripts/verify-roster.mjs",
};

/**
 * 官方脚手架输出里要删的文件：演示组件的示例页（它不属于任何一个区），以及每页的机读版——
 * llms 的三个路由与把 `.md` 请求转给它们的 proxy。机读文字只给生成物，普通页面不出机读版
 */
export const SCAFFOLD_FILES_REMOVED: readonly string[] = [
  "content/docs/test.mdx",
  "src/app/llms.txt/route.ts",
  "src/app/llms-full.txt/route.ts",
  "src/app/llms.mdx/docs/[[...slug]]/route.ts",
  "src/proxy.ts",
];

/** 官方输出（应用本机约定之后）里还连着每页机读版的几处：docs 页面上的复制与查看 markdown 按钮、算 md 地址的函数 */
export const SCAFFOLD_EDITS: readonly FileEdit[] = [
  {
    path: "src/app/docs/[[...slug]]/page.tsx",
    replacements: [
      ["  MarkdownCopyButton,\n  ViewOptionsPopover,\n", ""],
      ["import { getPageMarkdownUrl } from '@/lib/shared';\n", ""],
      ["  const markdownUrl = getPageMarkdownUrl(page).url;\n", ""],
      [
        '      <DocsDescription className="mb-0">{page.data.description}</DocsDescription>\n      <div className="flex flex-row gap-2 items-center border-b pb-6">\n        <MarkdownCopyButton markdownUrl={markdownUrl} />\n        <ViewOptionsPopover\n          markdownUrl={markdownUrl}\n        />\n      </div>\n',
        "      <DocsDescription>{page.data.description}</DocsDescription>\n",
      ],
    ],
  },
  {
    path: "src/lib/shared.ts",
    replacements: [
      ["export const docsContentRoute = '/llms.mdx/docs';\n", ""],
      [
        "const getContentUrl = createGetUrl(docsContentRoute);\n\nexport function getPageMarkdownUrl(page: { slugs: string[]; locale?: string }) {\n  const segments = [...page.slugs, 'content.md'];\n\n  return { segments, url: getContentUrl(segments, page.locale) };\n}\n\n",
        "",
      ],
    ],
  },
];

/** `planCreate` 的输入 */
export interface CreateInput {
  /** 站目录的绝对路径，它的上一级是仓 */
  siteDir: string;
  /** 仓根 package.json，没有是 null */
  repoManifest: RepoManifest | null;
  /** 结构模板（`readTemplate` 读出来的，还带 `.tpl` 后缀） */
  template: SiteTemplate;
  /** 显示名，不给就按 `siteTitle` 的规则认 */
  title?: string;
  /** 端口，不给由 `createSite` 选 */
  port?: number;
}

/**
 * 交给 `createSite` 的选项。`title` 传认好的显示名，站名与模板里的名字就是同一个。
 * 依赖、脚本、description 合进 package.json；文件改动分成新增、替换、删除、改四个清单。
 */
export function planCreate(input: CreateInput): SiteOptions {
  const values = valuesFor(input.siteDir, dirname(input.siteDir), input.repoManifest, input.title);
  const toSiteFiles = (files: TemplateFile[]): SiteFile[] => renderFiles(files, values).map((file) => ({ path: file.rel, text: file.text }));
  return {
    dir: input.siteDir,
    title: values.title,
    ...(input.port === undefined ? {} : { port: input.port }),
    description: `${values.title} 的文档站（docfirst）：仓根 README / AGENTS / CLAUDE 由 render 生成`,
    devDependencies: { ...DOCFIRST_DEPS },
    scripts: { ...DOC_SCRIPTS },
    addFiles: toSiteFiles(input.template.add),
    replaceFiles: toSiteFiles(input.template.replace),
    removeFiles: [...SCAFFOLD_FILES_REMOVED],
    editFiles: SCAFFOLD_EDITS.map((edit) => ({ path: edit.path, replacements: [...edit.replacements] })),
  };
}
