/* 最小 SVG 文档桩——给没有 DOM 的环境（服务端渲定妆照、node --test）用。
 * 只实现画家链路真用到的口：createElementNS / setAttribute / getAttribute / appendChild /
 * textContent / id / style / ownerDocument，外加一个序列化器把子树吐成 markup 字符串。
 * node-dom 的 el() 建子元素时走父节点的 ownerDocument，所以画家只要拿桩文档建根 svg，
 * 整棵树就都落在桩上；浏览器里照常走真 document，两边行为一眼看穿、不引 DOM 库。 */

/** 桩元素：属性表 + 子节点表 + 文本。 */
export class SvgStubElement {
  readonly tagName: string;
  readonly attrs = new Map<string, string>();
  readonly children: SvgStubElement[] = [];
  /** 元素样式袋：大图节点工厂会写 cursor，桩上只收着不解释 */
  readonly style: Record<string, string> = {};
  readonly ownerDocument: SvgStubDocument;
  private textValue = "";

  constructor(tagName: string, doc: SvgStubDocument) {
    this.tagName = tagName;
    this.ownerDocument = doc;
  }

  setAttribute(name: string, value: string): void {
    this.attrs.set(name, String(value));
  }

  getAttribute(name: string): string | null {
    return this.attrs.get(name) ?? null;
  }

  removeAttribute(name: string): void {
    this.attrs.delete(name);
  }

  appendChild<T extends SvgStubElement>(child: T): T {
    this.children.push(child);
    return child;
  }

  /** marker-end 引用要读 id：与真 DOM 同样反射 id 属性。 */
  get id(): string {
    return this.attrs.get("id") ?? "";
  }

  set id(v: string) {
    this.attrs.set("id", v);
  }

  get textContent(): string {
    return this.textValue;
  }

  /** 真 DOM 里赋 textContent 会清掉子树，桩同律。 */
  set textContent(v: string) {
    this.textValue = v;
    this.children.length = 0;
  }

  /** 递归收集子树里指定标签的全部元素（测试与画家自查用）。 */
  query(tag: string, out: SvgStubElement[] = []): SvgStubElement[] {
    for (const c of this.children) {
      if (c.tagName === tag) out.push(c);
      c.query(tag, out);
    }
    return out;
  }
}

/** 桩文档：只有 createElementNS 一个口（node-dom 的 el 只用它）。 */
export class SvgStubDocument {
  createElementNS(_ns: string, tag: string): SvgStubElement {
    return new SvgStubElement(tag, this);
  }
}

/** 文本位转义：属性值与文本内容共用，五个危险字符全数值实体化。 */
function escapeXml(s: string): string {
  return s.replace(/[&<>"']/g, (ch) => `&#${ch.charCodeAt(0)};`);
}

/** 桩子树序列化成 markup：属性按插入序、子节点按挂载序，文本内容转义。 */
export function serializeSvg(root: SvgStubElement): string {
  const attrs = [...root.attrs.entries()].map(([k, v]) => ` ${k}="${escapeXml(v)}"`).join("");
  const inner = root.children.length
    ? root.children.map(serializeSvg).join("")
    : escapeXml(root.textContent);
  return `<${root.tagName}${attrs}>${inner}</${root.tagName}>`;
}

/** 画家要的文档形状：真 Document 与桩都满足。 */
export type SvgDocument = Pick<Document, "createElementNS"> | SvgStubDocument;
