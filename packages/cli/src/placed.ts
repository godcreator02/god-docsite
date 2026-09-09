/**
 * 摆放产物的整形：格式包交出的 ai 产物是站上 .md 路由的形态，README / AGENTS / SKILL 这类
 * 宿主生态认死了路径的文件要的是干净 md——剥站上的标题锚记、还原被保守转义的加粗星号、
 * 去掉 frontmatter 段留下的开头空行；`outputs` 点名了 frontmatter 字段的（SKILL.md 要 name /
 * description 随行），再把 mdx 源头部那几行**原样**搬到产物头部。
 * 纯文本函数，不碰盘、不认识项目——render 与 check 两头共用，摆出去的和守着的是同一份。
 */

/** fumadocs 给站上 .md 路由的标题加的锚记（`# 标题 [#锚]`），摆放产物不要 */
const ANCHOR = /^(#{1,6} .+) \[#[^\]]*\]$/gm;
/** 序列化器紧跟标点后保守转义的加粗星号（`&#x2A;*` 是逃逸了一半的 `**`），摆放产物还原成可读的加粗 */
const STAR = /&#x2A;\*/g;
/** frontmatter 里一条顶层键的行头：列 0 起、`键:` */
const TOP_KEY = /^([\w-]+):/;
/** 产物开头整段 frontmatter：fumadocs 的 _markdown 已经没有它，md 格式包的 ai 产物还带着——摆放产物一律不带 */
const LEADING_FRONTMATTER = /^﻿?---\r?\n[\s\S]*?\r?\n---[ \t]*\r?\n?/;

/** 格式包的 ai 产物 → 摆放产物的正文（还没戴 frontmatter） */
export function tidyPlaced(rendered: string): string {
  return rendered.replace(LEADING_FRONTMATTER, "").replace(ANCHOR, "$1").replace(STAR, "**").replace(/^\n+/, "");
}

/** 挑出来的 frontmatter：点名的字段按源里的顺序原样成行；源里没有的字段列在 missing */
export interface PickedFrontmatter {
  lines: string[];
  missing: string[];
}

/**
 * 从 mdx / md 源的 frontmatter 里挑点名的字段，**逐行原样**搬出来——一条字段从它的顶层键行起，
 * 到下一条顶层键行止（块式列表、多行标量的缩进续行都跟着走）。不解析 YAML：搬的是作者写下的
 * 那几行，生成物头部长什么样作者一眼对得上。源没有 frontmatter、或字段不在，记进 missing。
 */
export function pickFrontmatter(source: string, fields: string[]): PickedFrontmatter {
  const text = source.replace(/^﻿/, "").replace(/\r\n/g, "\n");
  const blocks = new Map<string, string[]>();
  if (text.startsWith("---\n")) {
    const end = text.indexOf("\n---", 3);
    if (end >= 0) {
      let current: string[] | null = null;
      for (const line of text.slice(4, end).split("\n")) {
        const key = TOP_KEY.exec(line);
        if (key !== null) {
          current = [line];
          blocks.set(key[1]!, current);
        } else if (current !== null && /^[ \t]/.test(line)) {
          current.push(line);
        } else {
          current = null;
        }
      }
    }
  }
  const lines: string[] = [];
  const missing: string[] = [];
  for (const field of fields) {
    const block = blocks.get(field);
    if (block === undefined) missing.push(field);
    else lines.push(...block);
  }
  return { lines, missing };
}

/** 正文戴上 frontmatter：没挑出任何字段就是正文本身（字符串写法的 outputs 走的就是这条） */
export function withFrontmatter(body: string, lines: string[]): string {
  if (lines.length === 0) return body;
  return `---\n${lines.join("\n")}\n---\n\n${body}`;
}
