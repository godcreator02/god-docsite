/**
 * 术语组件：正文里点线下划线的那个词，鼠标移上去、或者聚焦上去，显示定义。
 *
 * **没有 "use client"，也没有任何状态**：展开靠 CSS 的 `:hover` 与 `:focus-within`，
 * 所以它是个服务端组件，不往客户端包里加一行 JS。
 *
 * **hover 不是唯一的打开方式**——触屏没有 hover，键盘也够不着。所以那个词是可聚焦的
 * （`tabIndex`），点一下、Tab 过去、回车都会让它拿到焦点，`:focus-within` 就展开了；
 * 定义框挂 `id` 与 `aria-describedby`，读屏软件念得出来。
 *
 * 定义是构建期写进属性的（见 glossary-plugin.ts），这儿不查任何表。
 * 样式在同包的 `./term.css`，站里 import 一次。
 */
import type { ReactNode } from "react";

/**
 * 定义框的 id 计数器。**服务端组件不会在浏览器里重渲**，所以这个号只要在一次渲染里
 * 不撞就够——同一次调用里同步取号、同步用掉，中间不 await，不存在并发交错。
 * 用不了 `useId`：那是客户端的钩子，用它就得把这个组件推成 "use client"。
 */
let seq = 0;

export interface TermProps {
  /** 一两句定义，构建期由标注插件填 */
  def: string;
  /** 详解在哪一页 */
  href?: string;
  /** 术语原词 */
  children?: ReactNode;
}

export function Term({ def, href, children }: TermProps) {
  seq += 1;
  const id = `livedoc-term-${String(seq)}`;
  return (
    <span className="livedoc-term">
      <span className="livedoc-term-word" tabIndex={0} aria-describedby={id}>
        {children}
      </span>
      <span className="livedoc-term-pop" id={id} role="tooltip">
        <span className="livedoc-term-def">{def}</span>
        {href === undefined ? null : (
          <a className="livedoc-term-more" href={href}>
            看详解
          </a>
        )}
      </span>
    </span>
  );
}
