/**
 * 最小 SVG 文档桩——Node 里没有 DOM，画布层节点工厂与着色的测试拿它顶上，不引 DOM 库。
 * 只实现节点工厂与着色真用到的口：createElementNS / setAttribute / getAttribute / appendChild /
 * textContent / style / ownerDocument，外加测试查子树用的 query。
 * node-dom 的 el() 建子元素时走父节点的 ownerDocument，所以拿桩文档建根 svg，整棵树就都落在桩上。
 */

/** 桩样式袋：节点工厂写 cursor，recolor 用 setProperty 写自定义属性（--dc），桩上只收着不解释。 */
export interface SvgStubStyle {
  [key: string]: unknown;
  setProperty(name: string, value: string): void;
}

/** 桩元素：属性表 + 子节点表 + 文本。 */
export class SvgStubElement {
  readonly tagName: string;
  readonly attrs = new Map<string, string>();
  readonly children: SvgStubElement[] = [];
  readonly style: SvgStubStyle = {
    setProperty: (name: string, value: string): void => {
      this.style[name] = value;
    },
  };
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

  appendChild<T extends SvgStubElement>(child: T): T {
    this.children.push(child);
    return child;
  }

  get textContent(): string {
    return this.textValue;
  }

  /** 真 DOM 里赋 textContent 会清掉子树，桩同律。 */
  set textContent(v: string) {
    this.textValue = v;
    this.children.length = 0;
  }

  /** 递归收集子树里指定标签的全部元素。 */
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
