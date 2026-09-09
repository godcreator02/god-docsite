/**
 * 站模板：包里带的那一整套 `.tpl`，读出来、在内存里渲染完。
 *
 * 模块内部件，不在建站接口的面上——调用方不必知道模板怎么摆、占位符叫什么。
 */
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

/** 模板文件的后缀，落盘时脱掉——带着它躺在包里，才不会被别的工具当成真配置去解析 */
const SUFFIX = ".tpl";

/**
 * 站模板的位置：从本模块所在目录往上找第一个装着 `template/docs-site` 的目录。
 *
 * 源码态是 `packages/cli/src/site/template.ts`（往上两层到包根）、产物态是 `packages/cli/dist/*.mjs`
 * （一层）——两态深度不同，所以往上找，不写死层数。都没找着就把最后一个候选交出去，
 * 让 readTemplate 带着完整路径报 ENOENT：import 期抛会让整个包加载不了。
 */
function locateTemplate(): string {
  let dir = fileURLToPath(new URL(".", import.meta.url));
  let candidate = join(dir, "template", "docs-site");
  for (let up = 0; up < 4 && !existsSync(candidate); up += 1) {
    dir = dirname(dir);
    candidate = join(dir, "template", "docs-site");
  }
  return candidate;
}

/** 包里带的那份模板的绝对路径 */
export const SITE_TEMPLATE = locateTemplate();

/** 一个待落盘的文件：相对站目录的路径（正斜杠）加正文 */
export interface TemplateFile {
  rel: string;
  text: string;
}

/** 模板里的占位符集合。认不出的占位符当场抛，见 renderText */
export interface SiteValues {
  /** 站自己的包名前缀（`<name>-docs-site`），得是合法的 npm 名字 */
  name: string;
  /** 站的显示名 */
  title: string;
  /** 被记录的仓的包名（`package.json` 的 name，取不到就退目录名） */
  pkg: string;
  /** 短名：包名去掉 scope 的那一截，正文里当称呼用 */
  pkgName: string;
  /** 站跑在哪个口 */
  port: string;
  /** 起手页里「第一条引用」那一块 */
  pinBlock: string;
}

/** 递归读出模板下所有文件，回相对路径（正斜杠）加正文 */
export function readTemplate(root: string = SITE_TEMPLATE): TemplateFile[] {
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

/** 认不出的占位符当场抛——留一个 `{{typo}}` 在生成的站里，没人知道它本来该是什么 */
export function renderText(text: string, values: SiteValues, rel: string): string {
  return text.replace(/\{\{(\w+)\}\}/g, (_whole, key: string) => {
    if (!(key in values)) throw new Error(`模板里有认不出的占位符 {{${key}}}（${rel}）`);
    return values[key as keyof SiteValues];
  });
}

/** 整套模板在内存里渲染完：占位符错了这一步就抛，盘上一个字都还没写 */
export function renderSite(template: TemplateFile[], values: SiteValues): TemplateFile[] {
  return template.map((file) => ({
    rel: file.rel.endsWith(SUFFIX) ? file.rel.slice(0, -SUFFIX.length) : file.rel,
    text: renderText(file.text, values, file.rel),
  }));
}
