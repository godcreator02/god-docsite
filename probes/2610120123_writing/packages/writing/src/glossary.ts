/**
 * 术语匹配的纯逻辑：一张术语表 + 一段文字 → 该标注的位置。
 *
 * 这一层不知道 remark、不知道 React、不读文件——喂词表和字符串进来，交回区间出去，
 * 所以它能单测。挂到语法树上是 `glossary-remark.ts` 的事，画成什么样是 `term.tsx` 的事。
 *
 * 两条匹配规矩，都是「标错了比不标更坏」推出来的：
 *   长词优先——先认最长的表面词，否则「总线」先命中，把「命令总线」切碎
 *   西文要词边界——`pane` 不许命中 `panel`；中文没有词边界，靠「不收单字词」兜着
 */

/** 一条术语。`def` 只写概念，别写会变的具体名——这张表钉不住，写进去就会腐化 */
export interface TermEntry {
  /** 词本身，也是术语页上的标题 */
  term: string;
  /** 别名、英文名、复数。跟 `term` 一起参与匹配 */
  aliases?: string[];
  /** 一两句定义 */
  def: string;
  /** 详解在哪一页 */
  href?: string;
}

/** 一处命中：`[start, end)` 是在原字符串里的下标 */
export interface TermSpan {
  start: number;
  end: number;
  entry: TermEntry;
}

/** 一条可匹配的表面词，连着它属于哪条术语 */
interface Surface {
  text: string;
  /** 全是西文字符——这种才做词边界检查 */
  ascii: boolean;
  entry: TermEntry;
}

/** 建好的索引：表面词按长度降序排好，匹配时从长到短试 */
export interface TermIndex {
  surfaces: Surface[];
}

/** 词边界那一侧算不算「词里的字符」 */
const isWordChar = (ch: string | undefined): boolean => ch !== undefined && /[A-Za-z0-9_]/.test(ch);

/** 整串都是西文可见字符 */
const isAscii = (text: string): boolean => /^[\x21-\x7e]+$/.test(text);

/**
 * 建索引。三种词当场拒——**建表这一步报错，比站上标出一片虚线好查得多**：
 *   空白词、单字词（中文单字会命中一切）、两条术语抢同一个表面词（标出来是哪条全看顺序）
 */
export function buildTermIndex(entries: readonly TermEntry[]): TermIndex {
  const seen = new Map<string, string>();
  const surfaces: Surface[] = [];
  for (const entry of entries) {
    for (const raw of [entry.term, ...(entry.aliases ?? [])]) {
      const text = raw.trim();
      if (text === "") throw new Error(`术语「${entry.term}」有一个空的表面词`);
      if (text.length < 2) throw new Error(`术语表面词「${text}」只有一个字：单字词会命中一切，换个说法或者别收`);
      const owner = seen.get(text);
      if (owner !== undefined) throw new Error(`表面词「${text}」被「${owner}」和「${entry.term}」抢：一个词只能属于一条术语`);
      seen.set(text, entry.term);
      surfaces.push({ text, ascii: isAscii(text), entry });
    }
  }
  // 长的排前面：匹配时从长到短试，先占住的赢
  surfaces.sort((a, b) => b.text.length - a.text.length || a.text.localeCompare(b.text));
  return { surfaces };
}

/** 这一处命中合不合词边界。中文表面词不检查——它本来就没有边界可言 */
function boundaryOk(text: string, at: number, surface: Surface): boolean {
  if (!surface.ascii) return true;
  return !isWordChar(text[at - 1]) && !isWordChar(text[at + surface.text.length]);
}

/**
 * 在一段文字里找出该标注的位置，按出现顺序交回，互不重叠。
 *
 * `taken` 是跨调用的「这篇里已经标过谁」——同一个词一篇只标第一次。每次都标，
 * 正文会变成一片虚线：标注是为了解释，不是为了统计词频。传 `undefined` 就是每处都标。
 */
export function findTerms(text: string, index: TermIndex, taken?: Set<string>): TermSpan[] {
  const occupied = new Array<boolean>(text.length).fill(false);
  const spans: TermSpan[] = [];
  for (const surface of index.surfaces) {
    if (taken?.has(surface.entry.term) === true) continue;
    let from = 0;
    for (;;) {
      const at = text.indexOf(surface.text, from);
      if (at < 0) break;
      const end = at + surface.text.length;
      // 压着已经被更长的词占住的地方就跳过；边界不合也跳过
      const free = !occupied.slice(at, end).includes(true);
      if (free && boundaryOk(text, at, surface)) {
        for (let i = at; i < end; i += 1) occupied[i] = true;
        spans.push({ start: at, end, entry: surface.entry });
        if (taken !== undefined) {
          taken.add(surface.entry.term);
          break; // 一篇只标第一次，这条术语到此为止
        }
        from = end;
        continue;
      }
      from = at + 1;
    }
  }
  return spans.sort((a, b) => a.start - b.start);
}
