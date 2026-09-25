/**
 * 装配模板：读出包里的全部 `.tpl` 文件，在内存里渲染。
 *
 * 模板里没有骨架的那部分（package.json、tsconfig、postcss、pnpm-workspace、.npmrc），
 * 那些由站点插件 `@godcreator/gwb-docs-site` 生成，装配只写与 docfirst 有关的文件。
 */
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

/** 模板文件的后缀，写盘时去掉。带着它放在包里，别的工具才不会把模板当成真配置解析 */
const SUFFIX = ".tpl";

/**
 * 包里模板的绝对路径。源码 `src/template.ts` 与产物 `dist/template.js` 都在包根下一层，
 * 所以两种情况下相对位置相同；`tsconfig.build.json` 的 `include` 是 `src/*.ts`，产物只有一层。
 * 模板不进 `dist/`，靠 `package.json` 的 `files` 发布（`tests/artifact.test.ts` 检查）。
 */
export const ATTACH_TEMPLATE = fileURLToPath(new URL("../template/attach/", import.meta.url));

/** 一个待写的文件：相对站目录的路径（正斜杠）与正文 */
export interface TemplateFile {
  rel: string;
  text: string;
}

/** 模板里的占位符。认不出的占位符在渲染时抛出，见 renderText */
export interface SiteValues {
  /** 站的显示名 */
  title: string;
  /** 站目录的名字（约定是 `docs-site`），生成物里指回正本时用 */
  site: string;
}

/** 递归读出模板目录下的所有文件，返回相对路径（正斜杠）与正文 */
export function readTemplate(root: string = ATTACH_TEMPLATE): TemplateFile[] {
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

/** 认不出的占位符当场抛出：生成的站里留一个 `{{typo}}`，没人知道它本来该是什么 */
export function renderText(text: string, values: SiteValues, rel: string): string {
  return text.replace(/\{\{(\w+)\}\}/g, (_whole, key: string) => {
    if (!(key in values)) throw new Error(`模板里有认不出的占位符 {{${key}}}（${rel}）`);
    return values[key as keyof SiteValues];
  });
}

/** 在内存里渲染整套模板，去掉 `.tpl` 后缀 */
export function renderSite(template: TemplateFile[], values: SiteValues): TemplateFile[] {
  return template.map((file) => ({
    rel: file.rel.endsWith(SUFFIX) ? file.rel.slice(0, -SUFFIX.length) : file.rel,
    text: renderText(file.text, values, file.rel),
  }));
}
