import type { ReactNode } from 'react';

/** E-8 组件 C：不调用 asMarkdown——机读渲染时只剩 JSX，看输出成什么样 */
export function ComponentC({ children }: { children?: ReactNode }) {
  return <div data-probe="component-c">{children}</div>;
}
