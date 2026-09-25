/**
 * 假格式：记号是一行 `REF <正式记号的载荷>`（`REF ref file="src/greet.ts" lines="2-3" hash="…" blob="…"`、
 * `REF tree dir="src" depth="1"`……），草稿记号交给判定层认，`write` 只重写记号那一行。
 *
 * **它是这套东西的第二个真适配器**——`Format` 这条接缝分离的是「怎么认记号」与「怎么判新鲜」
 * 两种变化原因，生产那个是 fumadocs 口味的 mdx，测试这个就是它。判定层、命令行、摆放的测试都用它：
 * 那几层不认识任何真格式，测它们就不该把真格式拉进来。
 *
 * 开关 `render` 给它一个 AI 渲染（能当生成正本）；不开就是只核对、不渲染的格式。
 */
import { draftOf, fileOf, formalOf, parseFormal, RenderRefusal } from "../packages/docfirst-workflow/src/engine/index.ts";
import type { Format, Listing, Reference, Target } from "../packages/docfirst-workflow/src/engine/index.ts";

const MARK = /^REF\s+(.+)$/;

/** 一处还没确认的正式记号那一行：`REF ` + 载荷，不带记录属性 */
export const refLine = (target: Target): string => `REF ${formalOf(target, null)}`;

export interface FakeOptions {
  /** 出一份给 AI 读的 md：记号那一行换成投影出来的围栏 */
  render?: boolean;
}

/** 记号行换成围栏。语言按被引文件的后缀认，目录树那种没有文件就写 text。跟真格式一样：草稿记号渲染不了 */
function renderAi(text: string, listing: Listing): string {
  const lines = text.split("\n");
  const drafts = listing.items.filter((item) => item.reference.extra?.draft === true);
  if (drafts.length > 0) throw new RenderRefusal(drafts.map((item) => `第 ${item.reference.at + 1} 行是草稿记号，先 docfirst confirm`).join("；"));
  for (const item of listing.items) {
    const file = fileOf(item.reference.target);
    const lang = file !== null && file.endsWith(".ts") ? "ts" : "text";
    lines[item.reference.at] = [`\`\`\`${lang}`, ...(item.current ?? []), "```"].join("\n");
  }
  return lines.join("\n");
}

export function fakeFormat(name: string, suffix: string, options: FakeOptions = {}): Format {
  const format: Format = {
    name,
    claims: (doc) => doc.endsWith(suffix),
    marker: (target, record) => `REF ${formalOf(target, record)}`,
    parse(text) {
      const refs: Reference[] = [];
      text.split("\n").forEach((line, at) => {
        const m = MARK.exec(line.trim());
        if (m !== null) {
          const formal = parseFormal(m[1]!, `第 ${at + 1} 行`);
          if (formal === null) throw new Error(`第 ${at + 1} 行：REF 后面的动作词不认识`);
          refs.push({ ...formal, at, extra: { draft: false } });
          return;
        }
        const draft = draftOf(line, `第 ${at + 1} 行`);
        if (draft !== null) refs.push({ target: draft, record: null, at, extra: { draft: true } });
      });
      return refs;
    },
    write(text, references) {
      const lines = text.split("\n");
      for (const { target, record, at } of references) lines[at] = format.marker(target, record);
      return lines.join("\n");
    },
  };
  if (options.render === true) format.renderAi = (text, listing) => renderAi(text, listing);
  return format;
}
