import { failAt, isCommentOnlyExpression, type CompileContext, type MdastNode } from './context.ts';

export type AttributeSpec = Record<string, 'required' | 'optional'>;

/** 组件属性只收字符串字面量：写成 {…} 表达式、展开、没列出的属性、缺必填的属性都报错 */
export function attributesOf(context: CompileContext, element: MdastNode, spec: AttributeSpec): Record<string, string> {
  const values: Record<string, string> = {};
  for (const attribute of element.attributes as MdastNode[]) {
    if (attribute.type !== 'mdxJsxAttribute') failAt(context, element, `<${element.name}> 上不能写 {…} 展开属性`);
    const name = attribute.name as string;
    if (!Object.hasOwn(spec, name)) {
      const allowed = Object.keys(spec);
      failAt(context, element, `<${element.name}> 没有属性 ${name}${allowed.length ? `；能写的只有 ${allowed.join('、')}` : '；它不收任何属性'}`);
    }
    if (typeof attribute.value !== 'string') failAt(context, element, `<${element.name}> 的 ${name} 要写成字符串，如 ${name}="…"，不写成 {…} 也不省略值`);
    if (Object.hasOwn(values, name)) failAt(context, element, `<${element.name}> 的 ${name} 写了两次`);
    values[name] = attribute.value;
  }
  for (const [name, need] of Object.entries(spec)) if (need === 'required' && !Object.hasOwn(values, name)) failAt(context, element, `<${element.name}> 缺少属性 ${name}`);
  return values;
}

export function positiveIntegerOf(context: CompileContext, element: MdastNode, name: string, raw: string): number {
  if (!/^[1-9]\d*$/.test(raw)) failAt(context, element, `<${element.name}> 的 ${name} 要是正整数，这里写的是「${raw}」`);
  return Number(raw);
}

const isWhitespaceText = (node: MdastNode) => node.type === 'text' && !String(node.value).trim();

/**
 * 组件的子元素：标签各占一行时是块级元素，写在同一行时被包进一个段落成了行内元素；两种写法都认，
 * 去掉空白与纯注释后只剩元素，别的内容报错
 */
export function elementChildrenOf(context: CompileContext, element: MdastNode): MdastNode[] {
  const children: MdastNode[] = [];
  const collect = (nodes: MdastNode[]) => {
    for (const node of nodes) {
      if (isWhitespaceText(node) || isCommentOnlyExpression(node)) continue;
      if (node.type === 'paragraph') collect(node.children);
      else if (node.type === 'mdxJsxFlowElement' || node.type === 'mdxJsxTextElement') children.push(node);
      else failAt(context, node, `<${element.name}> 里只能放组件，这里出现了 ${node.type}`);
    }
  };
  collect(element.children);
  return children;
}

const FLOW_TYPES = new Set(['paragraph', 'heading', 'list', 'code', 'math', 'table', 'blockquote', 'thematicBreak', 'html', 'mdxJsxFlowElement', 'mdxFlowExpression', 'footnoteDefinition', 'definition']);

/** 组件里的一行文字（图题、表题、小标题）：标签在同一行时直接是行内内容，各占一行时包在一个段落里 */
export function phrasingChildrenOf(context: CompileContext, element: MdastNode): MdastNode[] {
  const children = (element.children as MdastNode[]).filter((node) => !isCommentOnlyExpression(node));
  if (children.length === 1 && children[0]!.type === 'paragraph') return children[0]!.children;
  if (children.every((node) => !FLOW_TYPES.has(node.type))) return children;
  return failAt(context, element, `<${element.name}> 里只能写一段文字`);
}
