import type { PlainMathRun, ReportInline } from '../types.ts';
import { failAt, isCommentOnlyExpression, located, type CompileContext, type MdastNode } from './context.ts';
import { explicitIdOf } from './ids.ts';
import { attributesOf } from './jsx.ts';
import { parseMdx, positionOf } from './parse.ts';

type Mark = 'strong' | 'em' | 'sub' | 'sup' | 'code';
type TextInline = Extract<ReportInline, { type: 'text' }>;
const MARK_ORDER: readonly Mark[] = ['strong', 'em', 'sub', 'sup', 'code'];
const MARK_ELEMENTS: Record<string, Mark> = { strong: 'strong', em: 'em', sub: 'sub', sup: 'sup' };

/** 只能单独成段的组件：写进一段文字中间时报错 */
export const BLOCK_COMPONENTS = new Set(['WordFigure', 'WordFigures', 'WordTable', 'WordAbstract', 'WordBibliography', 'WordReference', 'WordCaption', 'WordPanel', 'table', 'tr', 'th', 'td']);

/** 一段行内 MDX → docreport 行内节点：相邻、标记相同的文字合并，软换行按两侧字符连上或换成空格 */
export function inlinesOf(context: CompileContext, nodes: MdastNode[]): ReportInline[] {
  const collected: ReportInline[] = [];
  collectInlines(context, nodes, [], collected);
  return joinedSoftBreaks(mergedAdjacentTexts(collected));
}

function textWithMarks(text: string, marks: readonly Mark[]): TextInline {
  const sorted = MARK_ORDER.filter((mark) => marks.includes(mark));
  return sorted.length ? { type: 'text', text, marks: sorted } : { type: 'text', text };
}

function idTargetsOf(context: CompileContext, element: MdastNode, raw: string): string[] {
  const targets = raw.split(/\s+/).filter(Boolean);
  if (!targets.length) failAt(context, element, `<${element.name}> 的 to 不能空`);
  return targets.map((target) => explicitIdOf(target, context.file, positionOf(element)));
}

function rejectChildren(context: CompileContext, element: MdastNode) {
  if (element.children.some((child: MdastNode) => !isCommentOnlyExpression(child))) failAt(context, element, `<${element.name}> 不收子内容，写成 <${element.name} … />`);
}

function collectInlines(context: CompileContext, nodes: MdastNode[], marks: readonly Mark[], out: ReportInline[]): void {
  for (const node of nodes) {
    switch (node.type) {
      case 'text': out.push(located(context, textWithMarks(node.value, marks), node)); break;
      case 'emphasis': collectInlines(context, node.children, [...marks, 'em'], out); break;
      case 'strong': collectInlines(context, node.children, [...marks, 'strong'], out); break;
      case 'inlineCode': out.push(located(context, textWithMarks(node.value, [...marks, 'code']), node)); break;
      case 'inlineMath': out.push(located(context, context.ids.request({ type: 'math' as const, id: '', latex: node.value }, 'm'), node)); break;
      case 'break': out.push(located(context, { type: 'break' }, node)); break;
      case 'link': out.push(located(context, context.ids.request({ type: 'link' as const, id: '', text: linkTextOf(context, node), href: node.url }, 'link'), node)); break;
      case 'footnoteReference':
        out.push(located(context, context.ids.request({ type: 'note_ref' as const, id: '', target: explicitIdOf(node.label ?? node.identifier, context.file, positionOf(node)) }, 'fn'), node));
        break;
      case 'mdxJsxTextElement': collectElement(context, node, marks, out); break;
      case 'mdxTextExpression':
        if (!isCommentOnlyExpression(node)) failAt(context, node, '正文里不能写 {…} 表达式；只想写花括号就写成 \\{ \\}，注释写成 {/* … */}');
        break;
      case 'image':
      case 'imageReference': failAt(context, node, 'Markdown 图片 ![…](…) 不收：图写成 <WordFigure src="assets/…">图题</WordFigure>');
      case 'linkReference': failAt(context, node, '不支持引用式链接 [文字][名字]：链接写成 [文字](https://…)');
      case 'delete': failAt(context, node, '不支持删除线 ~~…~~');
      case 'html': failAt(context, node, '不支持原始 HTML');
      default: failAt(context, node, `这里不能写 ${node.type}`);
    }
  }
}

function collectElement(context: CompileContext, element: MdastNode, marks: readonly Mark[], out: ReportInline[]): void {
  const name = element.name as string | null;
  if (name !== null && Object.hasOwn(MARK_ELEMENTS, name)) {
    attributesOf(context, element, {});
    collectInlines(context, element.children, [...marks, MARK_ELEMENTS[name]!], out);
    return;
  }
  switch (name) {
    case 'WordRef': {
      const attributes = attributesOf(context, element, { to: 'required', show: 'optional' });
      rejectChildren(context, element);
      if (/\s/.test(attributes['to']!.trim())) failAt(context, element, '<WordRef> 的 to 只能写一个 id');
      const [target] = idTargetsOf(context, element, attributes['to']!);
      const show = attributes['show'];
      if (show !== undefined && show !== 'number' && show !== 'title') failAt(context, element, `<WordRef> 的 show 只能是 number 或 title（不写就显示「图 3-2」这种全称），这里写的是「${show}」`);
      const display = (show ?? 'label') as 'label' | 'number' | 'title';
      out.push(located(context, context.ids.request({ type: 'ref' as const, id: '', target: target!, display }, 'ref'), element));
      return;
    }
    case 'WordCite': {
      const attributes = attributesOf(context, element, { to: 'required' });
      rejectChildren(context, element);
      out.push(located(context, context.ids.request({ type: 'cite' as const, id: '', targets: idTargetsOf(context, element, attributes['to']!) }, 'cite'), element));
      return;
    }
    case 'WordPlainMath': {
      const attributes = attributesOf(context, element, { word: 'required' });
      const latex = plainMathFormulaOf(context, element);
      const plainText = plainMathRunsOf(context, element, attributes['word']!);
      out.push(located(context, context.ids.request({ type: 'math' as const, id: '', latex, plainText }, 'm'), element));
      return;
    }
    case 'br':
      attributesOf(context, element, {});
      rejectChildren(context, element);
      out.push(located(context, { type: 'break' }, element));
      return;
    default:
      if (name !== null && BLOCK_COMPONENTS.has(name)) failAt(context, element, `<${name}> 要单独成段，前后空一行，不写在一段文字中间`);
      failAt(context, element, unknownComponentMessage(name ?? '', '行内只能用 WordRef、WordCite、WordPlainMath 与 HTML 标签 sub、sup、strong、em、br'));
  }
}

/** 认不出的元素：大写开头、不以 Word 开头的单独说明——报告的组件名都以 Word 开头，小写的只认几个 HTML 标签 */
export function unknownComponentMessage(name: string, allowed: string): string {
  if (/^[A-Z]/.test(name) && !name.startsWith('Word')) return `报告里的组件都以 Word 开头，<${name}> 不认：${allowed}`;
  return `认不出组件 <${name}>：${allowed}`;
}

/** <WordPlainMath> 标签里的公式：只能是一个 $…$ */
function plainMathFormulaOf(context: CompileContext, element: MdastNode): string {
  const children = (element.children as MdastNode[]).filter((child) => !isCommentOnlyExpression(child));
  const only = children.length === 1 ? children[0]! : undefined;
  if (only?.type !== 'inlineMath') failAt(context, element, '<WordPlainMath word="…"> 的标签里只写一个行内公式 $…$，别的都不放');
  return only.value as string;
}

type PlainMathMark = NonNullable<PlainMathRun['marks']>[number];
const PLAIN_MATH_MARK_ORDER: readonly PlainMathMark[] = ['em', 'sub', 'sup'];

/** word 属性：Word 里写的文字，按正文的规则解析，只收文字、*斜体*、<sub>、<sup>；相邻同样式的文字合并 */
function plainMathRunsOf(context: CompileContext, element: MdastNode, word: string): PlainMathRun[] {
  const usage = '<WordPlainMath> 的 word 属性写 Word 用的文字，只能用文字、*斜体*、<sub>、<sup>';
  if (/[\r\n]/.test(word)) failAt(context, element, `${usage}，不能换行`);
  let root: MdastNode;
  try {
    root = parseMdx(word, '');
  } catch (error) {
    return failAt(context, element, `<WordPlainMath> 的 word 属性解析不了（位置从属性开头算）：${(error as Error).message}`);
  }
  const blocks = root.children as MdastNode[];
  if (blocks.length !== 1 || blocks[0]!.type !== 'paragraph') failAt(context, element, `${usage}，这里${blocks.length ? '不是一段文字' : '是空的'}`);
  const runs: PlainMathRun[] = [];
  const collect = (nodes: MdastNode[], marks: ReadonlySet<PlainMathMark>) => {
    for (const node of nodes) {
      if (node.type === 'text') {
        const sorted = PLAIN_MATH_MARK_ORDER.filter((mark) => marks.has(mark));
        const previous = runs.at(-1);
        if (previous && (previous.marks ?? []).join() === sorted.join()) previous.text += node.value;
        else runs.push(sorted.length ? { text: node.value, marks: sorted } : { text: node.value });
      } else if (node.type === 'emphasis') collect(node.children, new Set([...marks, 'em']));
      else if (node.type === 'mdxJsxTextElement' && (node.name === 'sub' || node.name === 'sup')) {
        if ((node.attributes as unknown[]).length) failAt(context, element, `${usage}，<${node.name}> 不带属性`);
        const script: PlainMathMark = node.name;
        if (marks.has(script === 'sub' ? 'sup' : 'sub')) failAt(context, element, '<WordPlainMath> 的 word 属性里同一段文字不能既是下标又是上标');
        collect(node.children, new Set([...marks, script]));
      } else failAt(context, element, `${usage}，这里出现了 ${node.type === 'mdxJsxTextElement' ? `<${node.name}>` : node.type}`);
    }
  };
  collect(blocks[0]!.children, new Set());
  if (!runs.some((run) => run.text)) failAt(context, element, `${usage}，这里是空的`);
  return runs.filter((run) => run.text);
}

function linkTextOf(context: CompileContext, link: MdastNode): string {
  const inlines: ReportInline[] = [];
  collectInlines(context, link.children, [], inlines);
  if (inlines.some((inline) => inline.type !== 'text' || inline.marks)) failAt(context, link, '链接文字只能是纯文字');
  return inlines.map((inline) => (inline as TextInline).text).join('');
}

const sameMarks = (a: TextInline, b: TextInline) => (a.marks ?? []).join() === (b.marks ?? []).join();

function mergedAdjacentTexts(inlines: ReportInline[]): ReportInline[] {
  const merged: ReportInline[] = [];
  for (const inline of inlines) {
    const previous = merged.at(-1);
    if (inline.type === 'text' && previous?.type === 'text' && sameMarks(previous, inline)) previous.text += inline.text;
    else merged.push(inline);
  }
  return merged;
}

/** 中日韩文字、全角标点与全角符号：软换行两侧都是它们时直接连上，不留空格 */
const CJK = /[⺀-⿿　-〿぀-ヿ㄀-ㇿ㐀-䶿一-鿿豈-﫿︰-﹏＀-￯]/;

function joinedSoftBreaks(inlines: ReportInline[]): ReportInline[] {
  const lastCharOf = (inline: ReportInline | undefined) => (inline?.type === 'text' ? inline.text.at(-1) : undefined);
  const firstCharOf = (inline: ReportInline | undefined) => (inline?.type === 'text' ? inline.text[0] : undefined);
  inlines.forEach((inline, index) => {
    if (inline.type !== 'text') return;
    inline.text = inline.text.replace(/[ \t]*\r?\n[ \t]*/g, (match, offset: number, whole: string) => {
      const before = offset > 0 ? whole[offset - 1] : lastCharOf(inlines[index - 1]);
      const after = offset + match.length < whole.length ? whole[offset + match.length] : firstCharOf(inlines[index + 1]);
      return before !== undefined && after !== undefined && CJK.test(before) && CJK.test(after) ? '' : ' ';
    });
  });
  return inlines.filter((inline) => inline.type !== 'text' || inline.text !== '');
}

/** 图题这类行内内容的纯文字：图不写 alt 时拿它当 alt */
export function plainTextOf(inlines: ReportInline[]): string {
  return inlines.map((inline) => {
    switch (inline.type) {
      case 'text': return inline.text;
      case 'math': return inline.plainText ? inline.plainText.map((run) => run.text).join('') : `$${inline.latex}$`;
      case 'link': return inline.text;
      case 'break': return ' ';
      default: return '';
    }
  }).join('').trim();
}
