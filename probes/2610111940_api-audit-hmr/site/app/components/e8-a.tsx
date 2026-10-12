import type { ReactNode } from 'react';
import { asMarkdown } from 'fumadocs-core/server';

/** E-8 组件 A：普通组件，asMarkdown() 为真时返回纯 Markdown 文字 */
export function ComponentA({ children }: { children?: ReactNode }) {
  if (asMarkdown()) {
    return '组件A的机读文字：把界面上的示意讲成一句话。';
  }
  return <div data-probe="component-a">{children}</div>;
}
