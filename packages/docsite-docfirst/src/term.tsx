/**
 * 术语组件：正文里点线下划线的那个词，鼠标移上去或聚焦上去显示定义。定义与详解地址是构建页面时由术语标注写进属性的。
 * 展开靠样式的 `:hover` 与 `:focus-within`；那个词可聚焦，触屏点一下、键盘 Tab 过去都能展开。样式是 docfirst-workflow 的 term.css
 */
import { useId, type ReactNode } from "react";

export interface TermProps {
  /** 一两句定义 */
  def: string;
  /** 详解在哪一页 */
  href?: string;
  /** 术语原词 */
  children?: ReactNode;
}

export function Term({ def, href, children }: TermProps) {
  const id = useId();
  return (
    <span className="docfirst-term">
      <span className="docfirst-term-word" tabIndex={0} aria-describedby={id}>
        {children}
      </span>
      <span className="docfirst-term-pop" id={id} role="tooltip">
        <span className="docfirst-term-def">{def}</span>
        {href === undefined ? null : (
          <a className="docfirst-term-more" href={href}>
            看详解
          </a>
        )}
      </span>
    </span>
  );
}
