/**
 * 装配模板：包里带的那一整套 `.tpl`，读出来、在内存里渲染完。
 *
 * 模块内部件，不在装配接口的面上——调用方不必知道模板怎么摆、占位符叫什么。
 * 这套模板里**没有骨架那半**（package.json、tsconfig、postcss、pnpm-workspace、.npmrc）：
 * 那几份归站件，装配只覆盖跟六区有关的那些文件。
 */
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

/** 模板文件的后缀，落盘时脱掉——带着它躺在包里，才不会被别的工具当成真配置去解析 */
const SUFFIX = ".tpl";

/**
 * 件里那份模板的绝对路径。源码态 `src/template.ts`、产物态 `dist/template.js` 都在**包根下
 * 一层**，所以两态是同一个相对位置——`tsconfig.build.json` 的 `include` 是 `src/*.ts`（一层，
 * 不带 `**`），产物于是是平的。哪天把实现摆进子目录，这条路就跑到 `dist/` 里去了。
 *
 * 模板从不进 `dist/`：它原地躺在包根，靠 `package.json` 的 `files` 发出去
 * （`tests/artifact.test.ts` 守着那一条）。站件 `@godcreator/gwb-docs-site` 带它那份骨架模板
 * 用的是同一套摆法——**两个件各带各的模板，是有意的对称**。
 */
export const ATTACH_TEMPLATE = fileURLToPath(new URL("../template/attach/", import.meta.url));

/** 一个待落盘的文件：相对站目录的路径（正斜杠）加正文 */
export interface TemplateFile {
  rel: string;
  text: string;
}

/** 模板里的占位符集合。认不出的占位符当场抛，见 renderText */
export interface SiteValues {
  /** 站的显示名 */
  title: string;
  /** 被记录的仓的包名（`package.json` 的 name，取不到就退目录名） */
  pkg: string;
  /** 短名：包名去掉 scope 的那一截，正文里当称呼用 */
  pkgName: string;
  /** 站跑在哪个口——骨架挑的那个，装配只是把它写进正文，不改它 */
  port: string;
  /** 起手页里「第一条引用」那一块 */
  pinBlock: string;
}

/** 递归读出模板下所有文件，回相对路径（正斜杠）加正文 */
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
