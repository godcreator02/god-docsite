/**
 * 术语组件：正文里点线下划线的那个词，鼠标移上去、或者聚焦上去，显示定义。
 *
 * 没有任何状态与副作用：展开全靠 CSS 的 `:hover` 与 `:focus-within`，不往客户端包里加一行交互代码。
 * React Router 是同构渲染，这个组件会出现在客户端产物里——所以 id 用 `useId` 生成：
 * 服务端渲染与浏览器 hydrate 得到同一个值，同一页多次渲染也互不重复，
 * 不需要 "use client" 指令（那是 Next.js App Router 的概念）。
 *
 * **hover 不是唯一的打开方式**——触屏没有 hover，键盘也够不着。所以那个词是可聚焦的
 * （`tabIndex`），点一下、Tab 过去、回车都会让它拿到焦点，`:focus-within` 就展开了；
 * 定义框挂 `id` 与 `aria-describedby`，读屏软件念得出来。
 *
 * 定义是构建期写进属性的（见 glossary-remark.ts），这儿不查任何表。
 * 样式在同包的 `./styles.css`，站里 import 一次。
 */
import { useId, type ReactNode } from "react";

export interface TermProps {
  /** 一两句定义，构建期由标注插件填 */
  def: string;
  /** 详解在哪一页 */
  href?: string;
  /** 术语原词 */
  children?: ReactNode;
}

export function Term({ def, href, children }: TermProps) {
  const id = useId();
  return (
    <span className="docsite-term">
      <span className="docsite-term-word" tabIndex={0} aria-describedby={id}>
        {children}
      </span>
      <span className="docsite-term-pop" id={id} role="tooltip">
        <span className="docsite-term-def">{def}</span>
        {href === undefined ? null : (
          <a className="docsite-term-more" href={href}>
            看详解
          </a>
        )}
      </span>
    </span>
  );
}
