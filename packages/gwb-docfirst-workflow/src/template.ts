/**
 * 站的结构模板：读出包里的全部 `.tpl` 文件，在内存里渲染。
 *
 * 站点插件先跑官方脚手架 create-fumadocs-app，再套本机约定，最后按调用方的清单改文件。模板分两个目录，
 * 对应清单里的两种改法：`template/add/` 是官方输出里没有、要新增的；`template/replace/` 是官方输出里有、
 * 要整份替换的。要删的文件在 `create.ts` 的 `SCAFFOLD_FILES_REMOVED` 里。
 * 本机约定管的那几份（package.json、global.css 等）不能出现在替换清单里，`tests/create.test.ts` 检查。
 */
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

/** 模板文件的后缀，写盘时去掉。带着它放在包里，别的工具才不会把模板当成真配置解析 */
const SUFFIX = ".tpl";

/**
 * 包里模板目录的绝对路径。源码 `src/template.ts` 与产物 `dist/template.js` 都在包根下一层，
 * 所以两种情况下相对位置相同；`tsconfig.build.json` 的 `include` 是 `src/*.ts`，产物只有一层。
 * 模板不进 `dist/`，靠 `package.json` 的 `files` 发布（`tests/artifact.test.ts` 检查）。
 */
export const TEMPLATE_ROOT = fileURLToPath(new URL("../template/", import.meta.url));

/** 一个待写的文件：相对站目录的路径（正斜杠）与正文 */
export interface TemplateFile {
  rel: string;
  text: string;
}

/** 整套模板：新增的与替换的分开放 */
export interface SiteTemplate {
  add: TemplateFile[];
  replace: TemplateFile[];
}

/** 模板里的占位符。认不出的占位符在渲染时抛出，见 renderText */
export interface SiteValues {
  /** 站的显示名 */
  title: string;
  /** 站目录的名字（约定是 `docs-site`），生成物里指回正本时用 */
  site: string;
}

/** 递归读出一个目录下的所有文件，返回相对路径（正斜杠）与正文 */
function readTree(root: string): TemplateFile[] {
  const walk = (prefix: string): TemplateFile[] => {
    const out: TemplateFile[] = [];
    for (const entry of readdirSync(join(root, prefix), { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
      const rel = prefix === "" ? entry.name : `${prefix}/${entry.name}`;
      if (entry.isDirectory()) out.push(...walk(rel));
      else out.push({ rel, text: readFileSync(join(root, rel), "utf8") });
    }
    return out;
  };
  return walk("");
}

/** 读出整套模板：`add/` 与 `replace/` 两个目录 */
export function readTemplate(root: string = TEMPLATE_ROOT): SiteTemplate {
  return { add: readTree(join(root, "add")), replace: readTree(join(root, "replace")) };
}

/** 认不出的占位符当场抛出：生成的站里留一个 `{{typo}}`，没人知道它本来该是什么 */
export function renderText(text: string, values: SiteValues, rel: string): string {
  return text.replace(/\{\{(\w+)\}\}/g, (_whole, key: string) => {
    if (!(key in values)) throw new Error(`模板里有认不出的占位符 {{${key}}}（${rel}）`);
    return values[key as keyof SiteValues];
  });
}

/** 在内存里渲染一组模板文件，去掉 `.tpl` 后缀 */
export function renderFiles(files: TemplateFile[], values: SiteValues): TemplateFile[] {
  return files.map((file) => ({
    rel: file.rel.endsWith(SUFFIX) ? file.rel.slice(0, -SUFFIX.length) : file.rel,
    text: renderText(file.text, values, file.rel),
  }));
}
