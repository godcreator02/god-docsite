"use client";

/**
 * 状态点的站点侧 pre 组件。覆盖 mdx-components 的 `pre`：
 *   有 `data-dot` 的代码块（引用变的）在标题栏右侧、复制按钮左边画一个 8px 圆点；
 *   没有的（普通围栏）原样走 fumadocs 的 CodeBlock，互不干扰。
 *
 * 必须是客户端组件：CodeBlock 是 "use client"，状态点要靠 Actions（一个函数）放进它的标题栏，
 * 服务端组件不能把函数传给客户端组件——所以 pre 也跟着标 "use client"，函数在同一侧直接传。
 *
 * 点是静态的、不交互；颜色和空心实心由随包发的 light.css 定。
 * 直接导出组件、不走工厂函数——工厂函数在客户端模块里，服务端的 getMDXComponents 只能「引用」组件本身。
 */

import { CodeBlock, Pre, type CodeBlockProps } from "fumadocs-ui/components/codeblock";
import type { ReactNode } from "react";

/** CodeBlock 的 props 全量（rehype 高亮加上的 title / 行号 meta 都在里面）再加我们自己的 data-dot */
type DocfirstPreProps = CodeBlockProps & { "data-dot"?: string };

/** CodeBlock 的 Actions 回调参数（fumadocs 里就是这个形状） */
type ActionsProps = { className?: string; children?: ReactNode };

export function DocfirstPre(props: DocfirstPreProps) {
  const { "data-dot": dot, children, ...rest } = props;

  if (dot === undefined) {
    return (
      <CodeBlock {...rest}>
        <Pre>{children}</Pre>
      </CodeBlock>
    );
  }

  return (
    <CodeBlock
      {...rest}
      Actions={({ className, children: actions, ...restActions }: ActionsProps) => (
        <div {...restActions} className={["docfirst-actions", className].filter(Boolean).join(" ")}>
          <span className="docfirst-dot" data-dot={dot} aria-hidden="true" />
          {actions}
        </div>
      )}
    >
      <Pre>{children}</Pre>
    </CodeBlock>
  );
}
